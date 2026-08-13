import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { inNeonTransaction } from "@/db/transaction";
import { paymentSubmissionSeats, paymentSubmissions } from "@/db/schema";
import {
  AuthorizationError,
  getOptionalSession,
  requirePrediction,
  requireSession,
} from "@/lib/authz";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { paymentCreateSchema } from "@/lib/schemas";
import {
  validatePaymentSeats,
} from "@/lib/payment-products";
import { reviewPaymentTransaction } from "@/lib/payment-review";
import { getDiscountQuote } from "@/lib/discount-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicPayment(payment: typeof paymentSubmissions.$inferSelect, seatNumbers?: string[]) {
  return {
    id: payment.id,
    year: payment.year,
    seatNumber: payment.seatNumber,
    seatNumbers: seatNumbers ?? [payment.seatNumber],
    productType: payment.productType,
    predictionId: payment.predictionId,
    method: payment.method,
    expectedAmount: payment.expectedAmount,
    originalAmount: payment.originalAmount,
    discountAmount: payment.discountAmount,
    currency: payment.currency,
    status: payment.status,
    hasReceipt: Boolean(payment.receiptBlobKey),
    submittedAt: payment.submittedAt,
  };
}

async function loadPaymentSeats(paymentId: string) {
  return getDatabase()
    .select({
      year: paymentSubmissionSeats.year,
      seatNumber: paymentSubmissionSeats.seatNumber,
      position: paymentSubmissionSeats.position,
    })
    .from(paymentSubmissionSeats)
    .where(eq(paymentSubmissionSeats.paymentId, paymentId))
    .orderBy(paymentSubmissionSeats.position);
}

async function autoAcceptPaymentIfEnabled(
  paymentId: string,
  settings: { autoAcceptPayments: boolean; updatedBy: string | null },
) {
  if (!settings.autoAcceptPayments) return null;
  await reviewPaymentTransaction({
    paymentId,
    actorUserId: settings.updatedBy,
    action: "approve",
    allowMissingReceipt: true,
    reviewSource: "auto",
  });
  const [payment] = await getDatabase()
    .select()
    .from(paymentSubmissions)
    .where(eq(paymentSubmissions.id, paymentId))
    .limit(1);
  return payment ?? null;
}

export async function GET() {
  try {
    const session = await requireSession();
    const payments = await getDatabase()
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.userId, session.user.id))
      .orderBy(desc(paymentSubmissions.createdAt));
    const withSeats = await Promise.all(
      payments.map(async (payment) => {
        const seats = await loadPaymentSeats(payment.id);
        return publicPayment(payment, seats.map((seat) => seat.seatNumber));
      }),
    );
    return NextResponse.json(
      { payments: withSeats },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({ request, scope: "payment-create", limit: 5, windowSeconds: 600 });
    const parsed = paymentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات الدفع غير صحيحة." }, { status: 400 });
    }

    const prediction = await requirePrediction(parsed.data.predictionId);
    if (prediction.year !== parsed.data.year || prediction.year !== 2026) {
      return NextResponse.json({ error: "الدفع متاح لتوقعات 2026 فقط." }, { status: 422 });
    }

    const validated = await validatePaymentSeats({
      year: parsed.data.year,
      productType: parsed.data.productType,
      seatNumbers: parsed.data.seatNumbers,
    });
    const primarySeat = validated.seatNumbers[0];
    if (primarySeat !== prediction.seatNumber) {
      return NextResponse.json({ error: "رقم التقرير لا يطابق رقم الجلوس الأساسي." }, { status: 400 });
    }
    if (validated.unlockedSeats.length) {
      return NextResponse.json(
        {
          code: "SEAT_ALREADY_UNLOCKED",
          error: "رقم الجلوس ده مفتوح بالفعل. اختار رقمًا آخر.",
          unlockedSeats: validated.unlockedSeats,
        },
        { status: 409 },
      );
    }

    const existingPending = parsed.data.discountCode ? [] : await getDatabase()
      .select()
      .from(paymentSubmissions)
      .where(
        and(
          eq(paymentSubmissions.year, parsed.data.year),
          eq(paymentSubmissions.seatNumber, primarySeat),
          eq(paymentSubmissions.productType, parsed.data.productType),
          eq(paymentSubmissions.status, "pending"),
        ),
      )
      .orderBy(desc(paymentSubmissions.createdAt))
      .limit(1);
    if (existingPending[0]) {
      const existingSeats = await loadPaymentSeats(existingPending[0].id);
      const sameSeats = existingSeats.length === validated.seatNumbers.length &&
        existingSeats.every((seat, index) => seat.seatNumber === validated.seatNumbers[index]);
      if (sameSeats) {
        const automaticallyReviewed = await autoAcceptPaymentIfEnabled(
          existingPending[0].id,
          validated.settings,
        );
        return NextResponse.json({
          payment: publicPayment(automaticallyReviewed ?? existingPending[0], existingSeats.map((seat) => seat.seatNumber)),
          existing: true,
          pending: !automaticallyReviewed,
        });
      }
    }

    const settings = validated.settings;
    const method = parsed.data.method;
    const preflightDiscount = parsed.data.discountCode ? await getDiscountQuote(parsed.data.discountCode, parsed.data.productType) : null;
    if (parsed.data.discountCode && !preflightDiscount) {
      return NextResponse.json({ code: "DISCOUNT_CODE_UNAVAILABLE", error: "الكود غير صالح أو انتهى عدد استخداماته." }, { status: 409 });
    }
    const enabled = method === "vodafone_cash"
      ? settings.vodafoneEnabled
      : method === "orange_cash"
        ? settings.orangeEnabled
        : settings.instapayEnabled;
    if (!enabled && preflightDiscount?.finalAmount !== 0) {
      return NextResponse.json({ error: "طريقة الدفع غير متاحة حاليًا." }, { status: 422 });
    }
    const recipient = method === "vodafone_cash"
      ? settings.vodafoneCashNumber
      : method === "orange_cash"
        ? settings.orangeCashNumber
        : settings.instapayIdentifier;
    const priceSnapshot = {
      settingsId: settings.id,
      priceEgp: validated.product.priceEgp,
      productType: validated.product.id,
      seatCount: validated.product.seatCount,
      method,
      recipient,
      instructions: settings.paymentInstructions,
    };
    const session = await getOptionalSession();
    const created = await inNeonTransaction(async (client) => {
      const originalAmount = Number(validated.product.priceEgp);
      let discountCodeId: string | null = null;
      let discountCode: string | null = null;
      let discountAmount = 0;
      let finalAmount = originalAmount;
      if (parsed.data.discountCode) {
        const lockedCode = await client.query<{
          id: string; code: string; discount_type: "percentage" | "fixed";
          discount_value: string; max_redemptions: number;
        }>(
          `SELECT dc.id, dc.code, dc.discount_type, dc.discount_value, dc.max_redemptions
           FROM discount_codes dc
           WHERE dc.code = $1 AND dc.active = true AND (dc.expires_at IS NULL OR dc.expires_at > now())
           FOR UPDATE`,
          [parsed.data.discountCode.trim().toUpperCase()],
        );
        const codeRow = lockedCode.rows[0];
        if (!codeRow) throw new Error("DISCOUNT_CODE_UNAVAILABLE");
        const usage = await client.query<{ used_count: number }>(
          `SELECT count(*)::int AS used_count FROM discount_redemptions WHERE discount_code_id = $1 AND status IN ('reserved', 'redeemed')`,
          [codeRow.id],
        );
        if (Number(usage.rows[0]?.used_count ?? 0) >= codeRow.max_redemptions) throw new Error("DISCOUNT_CODE_UNAVAILABLE");
        const usedBySeat = await client.query(
          `SELECT id FROM discount_redemptions WHERE discount_code_id = $1 AND year = $2 AND seat_number = $3 AND status IN ('reserved', 'redeemed') LIMIT 1`,
          [codeRow.id, parsed.data.year, primarySeat],
        );
        if (usedBySeat.rowCount) throw new Error("DISCOUNT_CODE_ALREADY_USED");
        const rawDiscount = codeRow.discount_type === "percentage"
          ? originalAmount * Number(codeRow.discount_value) / 100
          : Number(codeRow.discount_value);
        discountAmount = Math.min(originalAmount, Math.round((rawDiscount + Number.EPSILON) * 100) / 100);
        finalAmount = Math.max(0, Number((originalAmount - discountAmount).toFixed(2)));
        discountCodeId = codeRow.id;
        discountCode = codeRow.code;
      }
      const effectiveMethod = finalAmount === 0 ? "discount_code" : method;
      const effectiveSnapshot = { ...priceSnapshot, originalAmount: originalAmount.toFixed(2), discountAmount: discountAmount.toFixed(2), finalAmount: finalAmount.toFixed(2), discountCode };
      const inserted = await client.query<{
        id: string;
        year: number;
        seat_number: string;
        product_type: "single" | "friends_3";
        prediction_id: string;
        method: "vodafone_cash" | "orange_cash" | "instapay" | "discount_code";
        expected_amount: string;
        currency: string;
        status: "pending" | "approved" | "rejected" | "cancelled";
        receipt_blob_key: string | null;
        submitted_at: Date | null;
      }>(
        `INSERT INTO payment_submissions
          (user_id, saved_student_id, prediction_id, year, seat_number, product_type,
           method, expected_amount, original_amount, discount_amount, discount_code_id,
           price_snapshot_json, sender_identifier, transaction_reference, client_idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15)
         ON CONFLICT DO NOTHING
         RETURNING id, year, seat_number, product_type, prediction_id, method,
                   expected_amount, currency, status, receipt_blob_key, submitted_at`,
        [
          session?.user?.id ?? null,
          prediction.savedStudentId ?? null,
          prediction.id,
          parsed.data.year,
          primarySeat,
          validated.product.id,
          effectiveMethod,
          finalAmount.toFixed(2),
          originalAmount.toFixed(2),
          discountAmount.toFixed(2),
          discountCodeId,
          JSON.stringify(effectiveSnapshot),
          finalAmount === 0 ? "كود خصم" : "من الإيصال",
          parsed.data.transactionReference ?? null,
          parsed.data.idempotencyKey,
        ],
      );
      let payment = inserted.rows[0];
      if (!payment) {
        const existing = await client.query<typeof inserted.rows[number]>(
          `SELECT id, year, seat_number, product_type, prediction_id, method,
                  expected_amount, currency, status, receipt_blob_key, submitted_at
           FROM payment_submissions
           WHERE year = $1 AND seat_number = $2 AND client_idempotency_key = $3
           LIMIT 1`,
          [parsed.data.year, primarySeat, parsed.data.idempotencyKey],
        );
        payment = existing.rows[0];
      }
      if (!payment) throw new Error("PAYMENT_CREATE_FAILED");
      if (payment.product_type !== validated.product.id) throw new Error("PAYMENT_IDEMPOTENCY_CONFLICT");
      if (payment.status !== "pending") return payment;
      for (const [index, seatNumber] of validated.seatNumbers.entries()) {
        await client.query(
          `INSERT INTO payment_submission_seats (payment_id, year, seat_number, position)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (payment_id, year, seat_number) DO NOTHING`,
          [payment.id, parsed.data.year, seatNumber, index + 1],
        );
      }
      if (discountCodeId) {
        await client.query(
          `INSERT INTO discount_redemptions
            (discount_code_id, payment_id, year, seat_number, original_amount, discount_amount, final_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'reserved')`,
          [discountCodeId, payment.id, parsed.data.year, primarySeat, originalAmount.toFixed(2), discountAmount.toFixed(2), finalAmount.toFixed(2)],
        );
      }
      return payment;
    });
    const seats = await loadPaymentSeats(created.id);
    const automaticallyReviewed = created.status === "pending"
      ? Number(created.expected_amount) === 0
        ? (await reviewPaymentTransaction({ paymentId: created.id, actorUserId: null, action: "approve", allowMissingReceipt: true, reviewSource: "discount" }), (await getDatabase().select().from(paymentSubmissions).where(eq(paymentSubmissions.id, created.id)).limit(1))[0])
        : await autoAcceptPaymentIfEnabled(created.id, settings)
      : null;
    if (automaticallyReviewed) {
      return NextResponse.json({
        payment: publicPayment(automaticallyReviewed, seats.map((seat) => seat.seatNumber)),
        autoAccepted: automaticallyReviewed.status === "approved",
      });
    }
    return NextResponse.json(
      { payment: publicPayment({
        id: created.id,
        year: created.year,
        seatNumber: created.seat_number,
        productType: created.product_type,
        predictionId: created.prediction_id,
        method: created.method,
        expectedAmount: created.expected_amount,
        currency: created.currency,
        status: created.status,
        receiptBlobKey: created.receipt_blob_key,
        submittedAt: created.submitted_at,
      } as typeof paymentSubmissions.$inferSelect, seats.map((seat) => seat.seatNumber)) },
      { status: created.status === "pending" ? 201 : 200 },
    );
  } catch (error) {
    const status = error instanceof Error && error.message === "INVALID_ORIGIN"
      ? 403
      : error instanceof AuthorizationError
        ? error.status
        : 500;
    if (error instanceof Error && error.message === "DUPLICATE_PAYMENT_SEATS") {
      return NextResponse.json({ error: "كل رقم جلوس لازم يكون مختلف." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PAYMENT_SEAT_NOT_FOUND") {
      return NextResponse.json({ error: "كل أرقام الجلوس لازم تكون لنتيجة حقيقية في 2026." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_PRODUCT_SEAT_COUNT") {
      return NextResponse.json({ error: "اختار عدد أرقام الجلوس المناسب للعرض." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "FRIENDS_PRODUCT_DISABLED") {
      return NextResponse.json({ error: "عرض الصحاب غير متاح حاليًا." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "PAYMENT_IDEMPOTENCY_CONFLICT") {
      return NextResponse.json({ error: "مفتاح الطلب مستخدم لعرض مختلف. ابدأ طلبًا جديدًا." }, { status: 409 });
    }
    if (error instanceof Error && ["DISCOUNT_CODE_UNAVAILABLE", "DISCOUNT_CODE_ALREADY_USED"].includes(error.message)) {
      return NextResponse.json({ code: error.message, error: error.message === "DISCOUNT_CODE_ALREADY_USED" ? "الكود اتستخدم بالفعل مع رقم الجلوس ده." : "الكود غير صالح أو انتهى عدد استخداماته." }, { status: 409 });
    }
    console.error("Payment creation failed:", error);
    return NextResponse.json({ error: status === 404 ? "التقرير غير موجود." : "تعذر إنشاء طلب الدفع." }, { status });
  }
}

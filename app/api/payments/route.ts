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

    const existingPending = await getDatabase()
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
        return NextResponse.json({
          payment: publicPayment(existingPending[0], existingSeats.map((seat) => seat.seatNumber)),
          existing: true,
          pending: true,
        });
      }
    }

    const settings = validated.settings;
    const method = parsed.data.method;
    const enabled = method === "vodafone_cash"
      ? settings.vodafoneEnabled
      : method === "orange_cash"
        ? settings.orangeEnabled
        : settings.instapayEnabled;
    if (!enabled) {
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
      const inserted = await client.query<{
        id: string;
        year: number;
        seat_number: string;
        product_type: "single" | "friends_3";
        prediction_id: string;
        method: "vodafone_cash" | "orange_cash" | "instapay";
        expected_amount: string;
        currency: string;
        status: "pending" | "approved" | "rejected" | "cancelled";
        receipt_blob_key: string | null;
        submitted_at: Date | null;
      }>(
        `INSERT INTO payment_submissions
          (user_id, saved_student_id, prediction_id, year, seat_number, product_type,
           method, expected_amount, price_snapshot_json, sender_identifier,
           transaction_reference, client_idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
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
          method,
          validated.product.priceEgp,
          JSON.stringify(priceSnapshot),
          "من الإيصال",
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
      return payment;
    });
    const seats = await loadPaymentSeats(created.id);
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
    console.error("Payment creation failed:", error);
    return NextResponse.json({ error: status === 404 ? "التقرير غير موجود." : "تعذر إنشاء طلب الدفع." }, { status });
  }
}

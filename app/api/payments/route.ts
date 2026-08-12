import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissions } from "@/db/schema";
import {
  getOptionalSession,
  getSeatEntitlement,
  requireSession,
  requirePrediction,
  AuthorizationError,
} from "@/lib/authz";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { paymentCreateSchema } from "@/lib/schemas";
import { getPaymentSettings } from "@/lib/settings";
import { getSeatPaymentState } from "@/lib/payment-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicPayment(payment: typeof paymentSubmissions.$inferSelect) {
  return {
    id: payment.id,
    year: payment.year,
    seatNumber: payment.seatNumber,
    predictionId: payment.predictionId,
    method: payment.method,
    expectedAmount: payment.expectedAmount,
    currency: payment.currency,
    status: payment.status,
    hasReceipt: Boolean(payment.receiptBlobKey),
    submittedAt: payment.submittedAt,
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    const payments = await getDatabase()
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.userId, session.user.id))
      .orderBy(desc(paymentSubmissions.createdAt));
    return NextResponse.json(
      { payments: payments.map(publicPayment) },
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
    if (prediction.year !== 2026) {
      return NextResponse.json({ error: "الدفع متاح لتوقعات 2026 فقط." }, { status: 422 });
    }
    if (parsed.data.year && parsed.data.year !== prediction.year) {
      return NextResponse.json({ error: "بيانات المقعد لا تطابق التقرير." }, { status: 400 });
    }
    if (parsed.data.seatNumber && parsed.data.seatNumber !== prediction.seatNumber) {
      return NextResponse.json({ error: "بيانات المقعد لا تطابق التقرير." }, { status: 400 });
    }

    const seatNumber = prediction.seatNumber;
    const entitlement = await getSeatEntitlement({ year: 2026, seatNumber });
    if (entitlement) {
      return NextResponse.json(
        { code: "ALREADY_UNLOCKED", state: "unlocked", paymentId: entitlement.paymentId },
        { status: 409 },
      );
    }

    const pending = await getSeatPaymentState({ year: 2026, seatNumber });
    if (pending.status === "pending") {
      const [existing] = await getDatabase()
        .select()
        .from(paymentSubmissions)
        .where(eq(paymentSubmissions.id, pending.paymentId))
        .limit(1);
      if (existing) {
        return NextResponse.json(
          { payment: publicPayment(existing), existing: true, pending: true },
          { status: 200 },
        );
      }
    }

    const settings = await getPaymentSettings();
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
      priceEgp: settings.fullReportPriceEgp,
      method,
      recipient,
      instructions: settings.paymentInstructions,
    };
    const session = await getOptionalSession();
    const [created] = await getDatabase()
      .insert(paymentSubmissions)
      .values({
        userId: session?.user?.id ?? null,
        savedStudentId: prediction.savedStudentId ?? null,
        predictionId: prediction.id,
        year: 2026,
        seatNumber,
        method,
        expectedAmount: settings.fullReportPriceEgp,
        priceSnapshotJson: priceSnapshot,
        senderIdentifier: parsed.data.senderIdentifier || "من الإيصال",
        transactionReference: parsed.data.transactionReference,
        clientIdempotencyKey: parsed.data.idempotencyKey,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      return NextResponse.json({ payment: publicPayment(created) }, { status: 201 });
    }

    const [existing] = await getDatabase()
      .select()
      .from(paymentSubmissions)
      .where(
        and(
          eq(paymentSubmissions.year, 2026),
          eq(paymentSubmissions.seatNumber, seatNumber),
          eq(paymentSubmissions.clientIdempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    return existing
      ? NextResponse.json({ payment: publicPayment(existing), existing: true })
      : NextResponse.json({ error: "تعذر إنشاء طلب الدفع." }, { status: 409 });
  } catch (error) {
    const status = error instanceof Error && error.message === "INVALID_ORIGIN" ? 403 : error instanceof AuthorizationError ? error.status : 500;
    console.error("Payment creation failed:", error);
    return NextResponse.json({ error: status === 404 ? "التقرير غير موجود." : "تعذر إنشاء طلب الدفع." }, { status });
  }
}

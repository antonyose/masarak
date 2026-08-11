import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissions, user } from "@/db/schema";
import { AuthorizationError, hasAnnualEntitlement, requireOwnedPrediction, requireSession } from "@/lib/authz";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { paymentCreateSchema } from "@/lib/schemas";
import { getPaymentSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const payments = await getDatabase().select({ id: paymentSubmissions.id, predictionId: paymentSubmissions.predictionId, method: paymentSubmissions.method, expectedAmount: paymentSubmissions.expectedAmount, currency: paymentSubmissions.currency, status: paymentSubmissions.status, submittedAt: paymentSubmissions.submittedAt, reviewedAt: paymentSubmissions.reviewedAt, rejectionReason: paymentSubmissions.rejectionReason, hasReceipt: paymentSubmissions.receiptBlobKey }).from(paymentSubmissions).where(eq(paymentSubmissions.userId, session.user.id)).orderBy(desc(paymentSubmissions.createdAt));
    return NextResponse.json({ payments: payments.map(({ hasReceipt, ...item }) => ({ ...item, hasReceipt: Boolean(hasReceipt) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({ request, scope: "payment-create", limit: 5, windowSeconds: 600 });
    const session = await requireSession();
    const parsed = paymentCreateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "بيانات الدفع غير صحيحة." }, { status: 400 });
    const prediction = await requireOwnedPrediction(parsed.data.predictionId, session.user.id);
    if (await hasAnnualEntitlement({ userId: session.user.id, savedStudentId: prediction.savedStudentId, year: prediction.year })) {
      return NextResponse.json({ error: "هذه النتيجة مفعّلة بالفعل لكل تقارير 2026." }, { status: 409 });
    }
    const [account] = await getDatabase().select({ phone: user.phone }).from(user).where(eq(user.id, session.user.id)).limit(1);
    if (!account?.phone) return NextResponse.json({ error: "أكمل رقم الموبايل في حسابك قبل إرسال الدفع.", code: "PHONE_REQUIRED" }, { status: 422 });
    const settings = await getPaymentSettings();
    const enabled = parsed.data.method === "vodafone_cash" ? settings.vodafoneEnabled : parsed.data.method === "orange_cash" ? settings.orangeEnabled : settings.instapayEnabled;
    if (!enabled) return NextResponse.json({ error: "طريقة الدفع غير متاحة حاليًا." }, { status: 422 });
    const priceSnapshot = {
      settingsId: settings.id,
      priceEgp: settings.fullReportPriceEgp,
      method: parsed.data.method,
      recipient: parsed.data.method === "vodafone_cash" ? settings.vodafoneCashNumber : parsed.data.method === "orange_cash" ? settings.orangeCashNumber : settings.instapayIdentifier,
      instructions: settings.paymentInstructions,
    };
    const [created] = await getDatabase().insert(paymentSubmissions).values({
      userId: session.user.id,
      savedStudentId: prediction.savedStudentId,
      predictionId: prediction.id,
      method: parsed.data.method,
      expectedAmount: settings.fullReportPriceEgp,
      priceSnapshotJson: priceSnapshot,
      senderIdentifier: parsed.data.senderIdentifier,
      transactionReference: parsed.data.transactionReference,
      clientIdempotencyKey: parsed.data.idempotencyKey,
    }).onConflictDoNothing().returning();
    if (created) return NextResponse.json({ payment: created }, { status: 201 });
    const [existing] = await getDatabase().select().from(paymentSubmissions).where(and(eq(paymentSubmissions.userId, session.user.id), eq(paymentSubmissions.clientIdempotencyKey, parsed.data.idempotencyKey))).limit(1);
    return NextResponse.json({ payment: existing, existing: true });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : error instanceof Error && error.message === "INVALID_ORIGIN" ? 403 : 500;
    console.error("Payment creation failed:", error);
    return NextResponse.json({ error: status === 401 ? "يجب تسجيل الدخول." : "تعذر إنشاء طلب الدفع." }, { status });
  }
}

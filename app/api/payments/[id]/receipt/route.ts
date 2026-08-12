import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissions } from "@/db/schema";
import { AuthorizationError, getOptionalSession } from "@/lib/authz";
import { deletePrivateReceipt, uploadPrivateReceipt, validateReceipt } from "@/lib/private-blob";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let uploadedKey: string | null = null;
  try {
    assertSameOrigin(request);
    await enforceRateLimit({ request, scope: "receipt-upload", limit: 6, windowSeconds: 600 });
    const { id } = await context.params;
    const session = await getOptionalSession();
    const [payment] = await getDatabase().select().from(paymentSubmissions).where(eq(paymentSubmissions.id, id)).limit(1);
    if (!payment) return NextResponse.json({ error: "طلب الدفع غير موجود." }, { status: 404 });
    const form = await request.formData();
    const seatNumber = String(form.get("seatNumber") ?? "").trim();
    if (seatNumber && seatNumber !== payment.seatNumber) {
      return NextResponse.json({ error: "رقم الجلوس لا يطابق طلب الدفع." }, { status: 403 });
    }
    if (payment.userId && payment.userId !== session?.user?.id) {
      return NextResponse.json({ error: "طلب الدفع غير موجود." }, { status: 404 });
    }
    if (!payment.userId && seatNumber !== payment.seatNumber) {
      return NextResponse.json({ error: "أرسل رقم الجلوس مع الإيصال." }, { status: 400 });
    }
    if (payment.status !== "pending" || payment.receiptBlobKey) return NextResponse.json({ error: "لا يمكن تعديل إيصال هذا الطلب." }, { status: 409 });
    const file = form.get("receipt");
    if (!(file instanceof File)) return NextResponse.json({ error: "اختر صورة الإيصال." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = validateReceipt(bytes, file.type);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const [duplicate] = await getDatabase().select({ id: paymentSubmissions.id }).from(paymentSubmissions).where(eq(paymentSubmissions.receiptSha256, sha256)).limit(1);
    if (duplicate) return NextResponse.json({ error: "تم استخدام صورة الإيصال من قبل." }, { status: 409 });
    uploadedKey = await uploadPrivateReceipt(bytes, mime);
    const [updated] = await getDatabase().update(paymentSubmissions).set({ receiptBlobKey: uploadedKey, receiptSha256: sha256, submittedAt: new Date() }).where(and(eq(paymentSubmissions.id, id), eq(paymentSubmissions.status, "pending"), isNull(paymentSubmissions.receiptBlobKey))).returning({ id: paymentSubmissions.id, status: paymentSubmissions.status, submittedAt: paymentSubmissions.submittedAt });
    if (!updated) throw new Error("PAYMENT_UPLOAD_RACE");
    return NextResponse.json({ payment: updated }, { status: 201 });
  } catch (error) {
    if (uploadedKey) await deletePrivateReceipt(uploadedKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    const status = error instanceof AuthorizationError ? error.status : message === "RECEIPT_SIZE" ? 413 : message === "RECEIPT_TYPE" ? 415 : message.includes("duplicate key") ? 409 : 500;
    console.error("Receipt upload failed:", error);
    return NextResponse.json({ error: status === 413 ? "حجم الإيصال يجب ألا يتجاوز 5 ميجابايت." : status === 415 ? "الإيصال يجب أن يكون JPEG أو PNG أو WebP." : status === 409 ? "تم استخدام صورة الإيصال من قبل." : "تعذر رفع الإيصال." }, { status });
  }
}

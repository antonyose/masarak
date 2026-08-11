import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { reviewPaymentTransaction } from "@/lib/payment-review";
import { assertSameOrigin } from "@/lib/request-security";
import { paymentReviewSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const parsed = paymentReviewSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "قرار المراجعة غير صحيح." }, { status: 400 });
    const { id } = await context.params;
    const result = await reviewPaymentTransaction({
      paymentId: id,
      actorUserId: session.user.id,
      action: parsed.data.action,
      rejectionReason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
      requestId: request.headers.get("x-request-id") ?? randomUUID(),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = error instanceof AuthorizationError ? error.status : message === "PAYMENT_NOT_FOUND" ? 404 : message === "PAYMENT_NOT_PENDING" || message === "RECEIPT_REQUIRED" ? 409 : 500;
    return NextResponse.json({ error: message === "RECEIPT_REQUIRED" ? "لا يمكن الموافقة دون إيصال." : message === "PAYMENT_NOT_PENDING" ? "تمت مراجعة هذا الطلب بالفعل." : "تعذر مراجعة الدفع." }, { status });
  }
}

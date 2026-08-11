import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissions } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { getPrivateReceipt } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const [payment] = await getDatabase().select({ key: paymentSubmissions.receiptBlobKey }).from(paymentSubmissions).where(eq(paymentSubmissions.id, id)).limit(1);
    if (!payment?.key) return NextResponse.json({ error: "لا يوجد إيصال." }, { status: 404 });
    const receipt = await getPrivateReceipt(payment.key);
    if (!receipt || receipt.statusCode !== 200) return NextResponse.json({ error: "الإيصال غير موجود." }, { status: 404 });
    return new Response(receipt.stream, { headers: { "Content-Type": receipt.blob.contentType, "Content-Length": String(receipt.blob.size), "Cache-Control": "private, no-store", "Content-Disposition": "inline" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

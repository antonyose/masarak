import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissions, savedStudents, user } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const requested = new URL(request.url).searchParams.get("status");
    const status = requested === "approved" || requested === "rejected" ? requested : "pending";
    const rows = await getDatabase()
      .select({
        id: paymentSubmissions.id,
        status: paymentSubmissions.status,
        method: paymentSubmissions.method,
        expectedAmount: paymentSubmissions.expectedAmount,
        senderIdentifier: paymentSubmissions.senderIdentifier,
        transactionReference: paymentSubmissions.transactionReference,
        submittedAt: paymentSubmissions.submittedAt,
        reviewedAt: paymentSubmissions.reviewedAt,
        hasReceipt: paymentSubmissions.receiptBlobKey,
        userName: user.name,
        userEmail: user.email,
        studentName: savedStudents.studentNameSnapshot,
        seatNumber: savedStudents.seatNumber,
      })
      .from(paymentSubmissions)
      .innerJoin(user, eq(user.id, paymentSubmissions.userId))
      .innerJoin(savedStudents, eq(savedStudents.id, paymentSubmissions.savedStudentId))
      .where(
        status === "pending"
          ? and(eq(paymentSubmissions.status, status), isNotNull(paymentSubmissions.submittedAt))
          : eq(paymentSubmissions.status, status),
      )
      .orderBy(desc(paymentSubmissions.submittedAt));
    return NextResponse.json({ payments: rows.map(({ hasReceipt, ...row }) => ({ ...row, hasReceipt: Boolean(hasReceipt) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

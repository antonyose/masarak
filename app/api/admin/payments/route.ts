import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissionSeats, paymentSubmissions, predictionRuns, savedStudents, user } from "@/db/schema";
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
        productType: paymentSubmissions.productType,
        expectedAmount: paymentSubmissions.expectedAmount,
        senderIdentifier: paymentSubmissions.senderIdentifier,
        transactionReference: paymentSubmissions.transactionReference,
        submittedAt: paymentSubmissions.submittedAt,
        reviewedAt: paymentSubmissions.reviewedAt,
        hasReceipt: paymentSubmissions.receiptBlobKey,
        userName: user.name,
        userEmail: user.email,
        studentName: savedStudents.studentNameSnapshot,
        seatNumber: predictionRuns.seatNumber,
      })
      .from(paymentSubmissions)
      .innerJoin(predictionRuns, eq(predictionRuns.id, paymentSubmissions.predictionId))
      .leftJoin(user, eq(user.id, paymentSubmissions.userId))
      .leftJoin(savedStudents, eq(savedStudents.id, paymentSubmissions.savedStudentId))
      .where(
        status === "pending"
          ? and(eq(paymentSubmissions.status, status), isNotNull(paymentSubmissions.submittedAt))
          : eq(paymentSubmissions.status, status),
      )
      .orderBy(desc(paymentSubmissions.submittedAt));
    const payments = await Promise.all(rows.map(async ({ hasReceipt, ...row }) => {
      const seats = await getDatabase()
        .select({ seatNumber: paymentSubmissionSeats.seatNumber, position: paymentSubmissionSeats.position })
        .from(paymentSubmissionSeats)
        .where(eq(paymentSubmissionSeats.paymentId, row.id))
        .orderBy(paymentSubmissionSeats.position);
      return { ...row, seatNumbers: seats.length ? seats.map((seat) => seat.seatNumber) : [row.seatNumber], hasReceipt: Boolean(hasReceipt) };
    }));
    return NextResponse.json({ payments }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

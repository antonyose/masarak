import { NextResponse } from "next/server";
import { and, desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissionSeats, paymentSubmissions, predictionRuns, savedStudents, user } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const requested = params.get("status");
    const status = requested === "all" || requested === "approved" || requested === "rejected" || requested === "cancelled" ? requested : "pending";
    const query = params.get("q")?.trim() ?? "";
    const method = params.get("method");
    const productType = params.get("productType");
    const limit = Math.min(Math.max(Number(params.get("limit")) || 500, 1), 1000);
    const filters = [];
    if (status !== "all") filters.push(eq(paymentSubmissions.status, status));
    if (status === "pending") filters.push(isNotNull(paymentSubmissions.submittedAt));
    if (method === "vodafone_cash" || method === "orange_cash" || method === "instapay") {
      filters.push(eq(paymentSubmissions.method, method));
    }
    if (productType === "single" || productType === "friends_3") {
      filters.push(eq(paymentSubmissions.productType, productType));
    }
    if (query) {
      filters.push(or(
        ilike(paymentSubmissions.seatNumber, `%${query}%`),
        ilike(paymentSubmissions.senderIdentifier, `%${query}%`),
        ilike(paymentSubmissions.transactionReference, `%${query}%`),
        ilike(user.name, `%${query}%`),
        ilike(user.email, `%${query}%`),
      ));
    }
    const where = filters.length ? and(...filters) : undefined;
    const rows = await getDatabase()
      .select({
        id: paymentSubmissions.id,
        status: paymentSubmissions.status,
        method: paymentSubmissions.method,
        productType: paymentSubmissions.productType,
        expectedAmount: paymentSubmissions.expectedAmount,
        senderIdentifier: paymentSubmissions.senderIdentifier,
        transactionReference: paymentSubmissions.transactionReference,
        rejectionReason: paymentSubmissions.rejectionReason,
        createdAt: paymentSubmissions.createdAt,
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
      .where(where)
      .orderBy(desc(paymentSubmissions.submittedAt))
      .limit(limit);
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

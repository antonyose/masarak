import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { paymentSubmissionSeats, paymentSubmissions, seatEntitlements } from "@/db/schema";

export type SeatPaymentState =
  | { status: "unlocked"; paymentId?: string }
  | { status: "pending"; paymentId: string; hasReceipt: boolean }
  | { status: "rejected"; paymentId: string }
  | { status: "none" };

export async function getSeatPaymentState({
  year,
  seatNumber,
}: {
  year: number;
  seatNumber: string;
}): Promise<SeatPaymentState> {
  const [entitlement] = await getDatabase()
    .select({ paymentId: seatEntitlements.paymentId })
    .from(seatEntitlements)
    .where(
      and(
        eq(seatEntitlements.year, year),
        eq(seatEntitlements.seatNumber, seatNumber),
      ),
    )
    .limit(1);
  if (entitlement) return { status: "unlocked", paymentId: entitlement.paymentId };

  const [linkedSeat] = await getDatabase()
    .select({ paymentId: paymentSubmissionSeats.paymentId })
    .from(paymentSubmissionSeats)
    .where(
      and(
        eq(paymentSubmissionSeats.year, year),
        eq(paymentSubmissionSeats.seatNumber, seatNumber),
      ),
    )
    .limit(1);
  const [payment] = linkedSeat
    ? await getDatabase()
      .select({
        id: paymentSubmissions.id,
        status: paymentSubmissions.status,
        receiptBlobKey: paymentSubmissions.receiptBlobKey,
      })
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, linkedSeat.paymentId))
      .limit(1)
    : await getDatabase()
    .select({
      id: paymentSubmissions.id,
      status: paymentSubmissions.status,
      receiptBlobKey: paymentSubmissions.receiptBlobKey,
    })
    .from(paymentSubmissions)
    .where(
      and(
        eq(paymentSubmissions.year, year),
        eq(paymentSubmissions.seatNumber, seatNumber),
      ),
    )
    .orderBy(desc(paymentSubmissions.createdAt))
    .limit(1);
  if (!payment) return { status: "none" };
  if (payment.status === "pending") {
    return {
      status: "pending",
      paymentId: payment.id,
      hasReceipt: Boolean(payment.receiptBlobKey),
    };
  }
  if (payment.status === "rejected") {
    return { status: "rejected", paymentId: payment.id };
  }
  return { status: "none" };
}

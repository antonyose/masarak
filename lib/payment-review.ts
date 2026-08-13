import "server-only";

import { inNeonTransaction } from "@/db/transaction";

type PaymentSeatRow = {
  year: number;
  seat_number: string;
  position: number;
};

export async function reviewPaymentTransaction({
  paymentId,
  actorUserId,
  action,
  allowMissingReceipt = false,
  reviewSource = "manual",
  rejectionReason,
  requestId,
}: {
  paymentId: string;
  actorUserId: string | null;
  action: "approve" | "reject";
  allowMissingReceipt?: boolean;
  reviewSource?: "manual" | "auto" | "discount";
  rejectionReason?: string;
  requestId?: string;
}) {
  return inNeonTransaction(async (client) => {
    const locked = await client.query<{
      id: string;
      status: "pending" | "approved" | "rejected" | "cancelled";
      user_id: string | null;
      saved_student_id: string | null;
      prediction_id: string;
      year: number;
      seat_number: string;
      product_type: "single" | "friends_3";
      receipt_blob_key: string | null;
    }>(
      `SELECT id, status, user_id, saved_student_id, prediction_id, year, seat_number,
              product_type, receipt_blob_key
       FROM payment_submissions WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    const payment = locked.rows[0];
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    if (payment.status === "approved" && action === "approve") {
      return { status: "approved" as const, idempotent: true };
    }
    if (payment.status !== "pending") throw new Error("PAYMENT_NOT_PENDING");
    if (action === "approve" && !payment.receipt_blob_key && !allowMissingReceipt) {
      throw new Error("RECEIPT_REQUIRED");
    }

    const seatResult = await client.query<PaymentSeatRow>(
      `SELECT year, seat_number, position
       FROM payment_submission_seats
       WHERE payment_id = $1
       ORDER BY seat_number, position
       FOR UPDATE`,
      [paymentId],
    );
    const seats = seatResult.rows.length
      ? seatResult.rows
      : [{ year: payment.year, seat_number: payment.seat_number, position: 1 }];
    const expectedCount = payment.product_type === "friends_3" ? 3 : 1;
    if (seats.length !== expectedCount || new Set(seats.map((seat) => seat.seat_number)).size !== seats.length) {
      throw new Error("PAYMENT_SEAT_SET_INVALID");
    }

    if (action === "approve") {
      for (const seat of [...seats].sort((a, b) => a.seat_number.localeCompare(b.seat_number))) {
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
          [String(seat.year), seat.seat_number],
        );
      }
      const existing = await client.query<{ seat_number: string }>(
        `SELECT seat_number
         FROM seat_entitlements
         WHERE year = ANY($1::int[]) AND seat_number = ANY($2::text[])
         FOR UPDATE`,
        [seats.map((seat) => seat.year), seats.map((seat) => seat.seat_number)],
      );
      if (existing.rows.length) {
        const unlockedSeats = existing.rows.map((row) => row.seat_number);
        const cancelled = await client.query(
          `UPDATE payment_submissions
           SET status = 'cancelled', reviewed_at = now(), reviewed_by = $2,
               rejection_reason = $3
           WHERE id = $1 AND status = 'pending'
           RETURNING id`,
          [paymentId, actorUserId, "واحد من أرقام الجلوس مفتوح بالفعل."],
        );
        if (cancelled.rowCount !== 1) throw new Error("PAYMENT_REVIEW_RACE");
        await client.query(`UPDATE discount_redemptions SET status = 'released', released_at = now() WHERE payment_id = $1 AND status = 'reserved'`, [paymentId]);
        await client.query(
          `INSERT INTO admin_audit_logs
            (actor_user_id, action, target_type, target_id, before_json, after_json, request_id)
           VALUES ($1, 'payment.cancelled_duplicate_seat', 'payment_submission', $2, $3::jsonb, $4::jsonb, $5)`,
          [
            actorUserId,
            paymentId,
            JSON.stringify({ status: "pending", seatNumbers: seats.map((seat) => seat.seat_number) }),
            JSON.stringify({ status: "cancelled", reason: "seat_already_unlocked", unlockedSeats }),
            requestId ?? null,
          ],
        );
        return { status: "cancelled" as const, idempotent: false, alreadyUnlocked: true };
      }
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    const updated = await client.query(
      `UPDATE payment_submissions
       SET status = $2, reviewed_at = now(), reviewed_by = $3, rejection_reason = $4
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [paymentId, nextStatus, actorUserId, rejectionReason ?? null],
    );
    if (updated.rowCount !== 1) throw new Error("PAYMENT_REVIEW_RACE");
    await client.query(
      `UPDATE discount_redemptions SET status = $2, redeemed_at = CASE WHEN $2 = 'redeemed' THEN now() ELSE redeemed_at END,
              released_at = CASE WHEN $2 = 'released' THEN now() ELSE released_at END
       WHERE payment_id = $1 AND status = 'reserved'`,
      [paymentId, action === "approve" ? "redeemed" : "released"],
    );

    if (action === "approve") {
      const seatNumbers = seats.map((seat) => seat.seat_number);
      const metadata = JSON.stringify({
        scope: "2026_all_stages",
        year: payment.year,
        productType: payment.product_type,
        seatNumbers,
        approvedWithoutReceipt: !payment.receipt_blob_key,
      });
      await client.query(
        `INSERT INTO credit_ledger
          (user_id, saved_student_id, prediction_id, payment_id, event_type, units, idempotency_key, metadata_json, created_by)
         VALUES ($1, $2, $3, $4, 'grant', $5, $6, $7::jsonb, $8)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId, seats.length, `payment:${paymentId}:grant`, metadata, actorUserId],
      );
      for (const seat of seats) {
        const inserted = await client.query(
          `INSERT INTO seat_entitlements
            (year, seat_number, origin_prediction_id, payment_id, scope)
           VALUES ($1, $2, $3, $4, 'year_all_stages')
           ON CONFLICT (year, seat_number) DO NOTHING
           RETURNING id`,
          [seat.year, seat.seat_number, seat.position === 1 ? payment.prediction_id : null, paymentId],
        );
        if (inserted.rowCount !== 1) throw new Error("PAYMENT_REVIEW_RACE");
      }
      if (payment.user_id && payment.saved_student_id) {
        await client.query(
          `INSERT INTO prediction_entitlements
            (user_id, saved_student_id, year, origin_prediction_id, payment_id, scope)
           VALUES ($1, $2, $3, $4, $5, 'year_all_stages')
           ON CONFLICT (user_id, saved_student_id, year) DO NOTHING`,
          [payment.user_id, payment.saved_student_id, payment.year, payment.prediction_id, paymentId],
        );
      }
      await client.query(
        `INSERT INTO credit_ledger
          (user_id, saved_student_id, prediction_id, payment_id, event_type, units, idempotency_key, metadata_json, created_by)
         VALUES ($1, $2, $3, $4, 'consume', $5, $6, $7::jsonb, $8)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId, -seats.length, `payment:${paymentId}:consume`, metadata, actorUserId],
      );
    }

    await client.query(
      `INSERT INTO admin_audit_logs
        (actor_user_id, action, target_type, target_id, before_json, after_json, request_id)
       VALUES ($1, $2, 'payment_submission', $3, $4::jsonb, $5::jsonb, $6)`,
      [
        actorUserId,
        reviewSource === "auto" && nextStatus === "approved" ? "payment.auto_approved" : reviewSource === "discount" && nextStatus === "approved" ? "payment.discount_approved" : `payment.${nextStatus}`,
        paymentId,
        JSON.stringify({ status: "pending", productType: payment.product_type, seatNumbers: seats.map((seat) => seat.seat_number) }),
        JSON.stringify({
          status: nextStatus,
          rejectionReason: rejectionReason ?? null,
          approvedWithoutReceipt: action === "approve" && !payment.receipt_blob_key,
          reviewSource,
        }),
        requestId ?? null,
      ],
    );
    return { status: nextStatus, idempotent: false };
  });
}

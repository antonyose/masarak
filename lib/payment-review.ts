import "server-only";

import { inNeonTransaction } from "@/db/transaction";

export async function reviewPaymentTransaction({
  paymentId,
  actorUserId,
  action,
  rejectionReason,
  requestId,
}: {
  paymentId: string;
  actorUserId: string;
  action: "approve" | "reject";
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
      receipt_blob_key: string | null;
    }>(
      `SELECT id, status, user_id, saved_student_id, prediction_id, year, seat_number, receipt_blob_key
       FROM payment_submissions WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    const payment = locked.rows[0];
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    if (payment.status === "approved" && action === "approve") {
      return { status: "approved" as const, idempotent: true };
    }
    if (payment.status !== "pending") throw new Error("PAYMENT_NOT_PENDING");
    if (action === "approve" && !payment.receipt_blob_key) {
      throw new Error("RECEIPT_REQUIRED");
    }

    if (action === "approve") {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
        [String(payment.year), payment.seat_number],
      );
      const existing = await client.query<{ id: string; payment_id: string }>(
        `SELECT id, payment_id
         FROM seat_entitlements
         WHERE year = $1 AND seat_number = $2
         FOR UPDATE`,
        [payment.year, payment.seat_number],
      );
      if (existing.rows[0]) {
        const cancelled = await client.query(
          `UPDATE payment_submissions
           SET status = 'cancelled', reviewed_at = now(), reviewed_by = $2,
               rejection_reason = $3
           WHERE id = $1 AND status = 'pending'
           RETURNING id`,
          [paymentId, actorUserId, "هذا المقعد مفتوح بالفعل."],
        );
        if (cancelled.rowCount !== 1) throw new Error("PAYMENT_REVIEW_RACE");
        await client.query(
          `INSERT INTO admin_audit_logs
            (actor_user_id, action, target_type, target_id, before_json, after_json, request_id)
           VALUES ($1, 'payment.cancelled_duplicate_seat', 'payment_submission', $2, $3::jsonb, $4::jsonb, $5)`,
          [
            actorUserId,
            paymentId,
            JSON.stringify({ status: "pending", year: payment.year, seatNumber: payment.seat_number }),
            JSON.stringify({ status: "cancelled", reason: "seat_already_unlocked" }),
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

    if (action === "approve") {
      const metadata = JSON.stringify({
        scope: "2026_all_stages",
        year: payment.year,
        seatNumber: payment.seat_number,
      });
      await client.query(
        `INSERT INTO credit_ledger
          (user_id, saved_student_id, prediction_id, payment_id, event_type, units, idempotency_key, metadata_json, created_by)
         VALUES ($1, $2, $3, $4, 'grant', 1, $5, $6::jsonb, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId, `payment:${paymentId}:grant`, metadata, actorUserId],
      );
      await client.query(
        `INSERT INTO seat_entitlements
          (year, seat_number, origin_prediction_id, payment_id, scope)
         VALUES ($1, $2, $3, $4, 'year_all_stages')
         ON CONFLICT (year, seat_number) DO NOTHING`,
        [payment.year, payment.seat_number, payment.prediction_id, paymentId],
      );
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
         VALUES ($1, $2, $3, $4, 'consume', -1, $5, $6::jsonb, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId, `payment:${paymentId}:consume`, metadata, actorUserId],
      );
    }

    await client.query(
      `INSERT INTO admin_audit_logs
        (actor_user_id, action, target_type, target_id, before_json, after_json, request_id)
       VALUES ($1, $2, 'payment_submission', $3, $4::jsonb, $5::jsonb, $6)`,
      [
        actorUserId,
        `payment.${nextStatus}`,
        paymentId,
        JSON.stringify({ status: "pending", year: payment.year, seatNumber: payment.seat_number }),
        JSON.stringify({ status: nextStatus, rejectionReason: rejectionReason ?? null }),
        requestId ?? null,
      ],
    );
    return { status: nextStatus, idempotent: false };
  });
}

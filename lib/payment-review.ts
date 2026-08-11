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
      user_id: string;
      saved_student_id: string;
      prediction_id: string;
      receipt_blob_key: string | null;
    }>(`SELECT id, status, user_id, saved_student_id, prediction_id, receipt_blob_key
       FROM payment_submissions WHERE id = $1 FOR UPDATE`, [paymentId]);
    const payment = locked.rows[0];
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    if (payment.status === "approved" && action === "approve") {
      return { status: "approved" as const, idempotent: true };
    }
    if (payment.status !== "pending") throw new Error("PAYMENT_NOT_PENDING");
    if (action === "approve" && !payment.receipt_blob_key) throw new Error("RECEIPT_REQUIRED");

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
      await client.query(
        `INSERT INTO credit_ledger
          (user_id, saved_student_id, prediction_id, payment_id, event_type, units, idempotency_key, metadata_json, created_by)
         VALUES ($1, $2, $3, $4, 'grant', 1, $5, $6::jsonb, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId, `payment:${paymentId}:grant`, JSON.stringify({ scope: "2026_all_stages" }), actorUserId],
      );
      await client.query(
        `INSERT INTO prediction_entitlements
          (user_id, saved_student_id, year, origin_prediction_id, payment_id, scope)
         VALUES ($1, $2, 2026, $3, $4, 'year_all_stages')
         ON CONFLICT (user_id, saved_student_id, year) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId],
      );
      await client.query(
        `INSERT INTO credit_ledger
          (user_id, saved_student_id, prediction_id, payment_id, event_type, units, idempotency_key, metadata_json, created_by)
         VALUES ($1, $2, $3, $4, 'consume', -1, $5, $6::jsonb, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [payment.user_id, payment.saved_student_id, payment.prediction_id, paymentId, `payment:${paymentId}:consume`, JSON.stringify({ entitlementYear: 2026 }), actorUserId],
      );
    }

    await client.query(
      `INSERT INTO admin_audit_logs
        (actor_user_id, action, target_type, target_id, before_json, after_json, request_id)
       VALUES ($1, $2, 'payment_submission', $3, $4::jsonb, $5::jsonb, $6)`,
      [actorUserId, `payment.${nextStatus}`, paymentId, JSON.stringify({ status: "pending" }), JSON.stringify({ status: nextStatus, rejectionReason: rejectionReason ?? null }), requestId ?? null],
    );
    return { status: nextStatus, idempotent: false };
  });
}

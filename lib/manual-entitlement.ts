import "server-only";

import { inNeonTransaction } from "@/db/transaction";

export type ManualEntitlementInput = {
  year: 2026;
  seatNumber: string;
  studentName: string;
  recordRevenue: boolean;
  amount: number;
  method: "vodafone_cash" | "orange_cash" | "instapay" | null;
  note?: string;
  actorUserId: string;
  requestId?: string;
};

export async function grantManualSeatEntitlement(input: ManualEntitlementInput) {
  return inNeonTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`, [
      String(input.year),
      input.seatNumber,
    ]);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM seat_entitlements WHERE year = $1 AND seat_number = $2 FOR UPDATE`,
      [input.year, input.seatNumber],
    );
    if (existing.rows.length) throw new Error("SEAT_ALREADY_UNLOCKED");

    const grant = await client.query<{ id: string }>(
      `INSERT INTO admin_manual_entitlement_grants
        (year, seat_number, student_name_snapshot, record_revenue, amount, method, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.year,
        input.seatNumber,
        input.studentName,
        input.recordRevenue,
        input.recordRevenue ? input.amount : 0,
        input.recordRevenue ? input.method : null,
        input.note || null,
        input.actorUserId,
      ],
    );
    const grantId = grant.rows[0]?.id;
    if (!grantId) throw new Error("MANUAL_GRANT_FAILED");

    const entitlement = await client.query<{ id: string }>(
      `INSERT INTO seat_entitlements
        (year, seat_number, payment_id, manual_grant_id, scope)
       VALUES ($1, $2, NULL, $3, 'year_all_stages')
       RETURNING id`,
      [input.year, input.seatNumber, grantId],
    );
    if (!entitlement.rows[0]?.id) throw new Error("MANUAL_GRANT_RACE");

    await client.query(
      `INSERT INTO credit_ledger
        (payment_id, event_type, units, idempotency_key, metadata_json, created_by)
       VALUES (NULL, 'grant', 1, $1, $2::jsonb, $3)`,
      [
        `manual-grant:${grantId}:grant`,
        JSON.stringify({
          scope: "2026_all_stages",
          year: input.year,
          seatNumber: input.seatNumber,
          manualGrantId: grantId,
          recordRevenue: input.recordRevenue,
          amount: input.recordRevenue ? input.amount : 0,
          method: input.recordRevenue ? input.method : null,
        }),
        input.actorUserId,
      ],
    );
    await client.query(
      `INSERT INTO admin_audit_logs
        (actor_user_id, action, target_type, target_id, before_json, after_json, request_id)
       VALUES ($1, 'entitlement.manual_grant', 'seat_entitlement', $2, NULL, $3::jsonb, $4)`,
      [
        input.actorUserId,
        input.seatNumber,
        JSON.stringify({
          year: input.year,
          studentName: input.studentName,
          manualGrantId: grantId,
          recordRevenue: input.recordRevenue,
          amount: input.recordRevenue ? input.amount : 0,
          method: input.recordRevenue ? input.method : null,
          note: input.note || null,
        }),
        input.requestId ?? null,
      ],
    );

    return {
      grantId,
      entitlementId: entitlement.rows[0].id,
      seatNumber: input.seatNumber,
      studentName: input.studentName,
      recordRevenue: input.recordRevenue,
    };
  });
}

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = vi.fn();
vi.mock("@/db/transaction", () => ({
  inNeonTransaction: async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }),
}));

import { reviewPaymentTransaction } from "@/lib/payment-review";

function configurePayment({ productType = "single", seats = ["2001970"], existing = [] as Array<{ seat_number: string }> } = {}) {
  query.mockImplementation(async (statement: unknown) => {
    const sql = String(statement ?? "");
    if (sql.includes("FROM payment_submissions")) {
      return { rows: [{ id: "payment", status: "pending", user_id: "user", saved_student_id: "student", prediction_id: "prediction", year: 2026, seat_number: seats[0], product_type: productType, receipt_blob_key: "receipts/private.webp" }] };
    }
    if (sql.includes("FROM payment_submission_seats")) {
      return { rows: seats.map((seat_number, index) => ({ year: 2026, seat_number, position: index + 1 })) };
    }
    if (sql.includes("FROM seat_entitlements")) return { rows: existing };
    if (sql.includes("UPDATE payment_submissions")) return { rowCount: 1, rows: [] };
    return { rowCount: 1, rows: [] };
  });
}

function configurePaymentWithoutReceipt() {
  query.mockImplementation(async (statement: unknown) => {
    const sql = String(statement ?? "");
    if (sql.includes("FROM payment_submissions")) {
      return { rows: [{ id: "payment", status: "pending", user_id: null, saved_student_id: null, prediction_id: "prediction", year: 2026, seat_number: "2001970", product_type: "single", receipt_blob_key: null }] };
    }
    if (sql.includes("FROM payment_submission_seats")) return { rows: [{ year: 2026, seat_number: "2001970", position: 1 }] };
    if (sql.includes("FROM seat_entitlements")) return { rows: [] };
    if (sql.includes("UPDATE payment_submissions")) return { rowCount: 1, rows: [] };
    return { rowCount: 1, rows: [] };
  });
}

describe("payment review transaction", () => {
  beforeEach(() => query.mockReset());

  it("creates one entitlement and matching ledger events for an individual approval", async () => {
    configurePayment();
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).resolves.toEqual({ status: "approved", idempotent: false });
    const statements = query.mock.calls.map(([statement]) => String(statement));
    expect(statements.filter((statement) => statement.includes("INSERT INTO seat_entitlements")).length).toBe(1);
    expect(statements.some((statement) => statement.includes("'grant', $5"))).toBe(true);
    expect(statements.some((statement) => statement.includes("'consume', $5"))).toBe(true);
    expect(statements.some((statement) => statement.includes("admin_audit_logs"))).toBe(true);
  });

  it("creates exactly three entitlements for a friends approval", async () => {
    configurePayment({ productType: "friends_3", seats: ["2001970", "2001980", "2001990"] });
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).resolves.toEqual({ status: "approved", idempotent: false });
    const statements = query.mock.calls.map(([statement]) => String(statement));
    expect(statements.filter((statement) => statement.includes("INSERT INTO seat_entitlements")).length).toBe(3);
    const grantCall = query.mock.calls.find(([statement]) => String(statement).includes("'grant'"));
    expect(grantCall?.[1]).toContain(3);
  });

  it("requires an explicit override before approving without a receipt", async () => {
    configurePaymentWithoutReceipt();
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).rejects.toThrow("RECEIPT_REQUIRED");
  });

  it("approves without a receipt when the admin explicitly overrides it", async () => {
    configurePaymentWithoutReceipt();
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve", allowMissingReceipt: true })).resolves.toMatchObject({ status: "approved" });
    const auditCall = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO admin_audit_logs"));
    expect(auditCall?.[1]?.join(" ")).toContain("approvedWithoutReceipt");
  });

  it("labels automatic approvals distinctly in the audit log", async () => {
    configurePaymentWithoutReceipt();
    await reviewPaymentTransaction({ paymentId: "payment", actorUserId: null, action: "approve", allowMissingReceipt: true, reviewSource: "auto" });
    const auditCall = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO admin_audit_logs"));
    expect(auditCall?.[1]?.[1]).toBe("payment.auto_approved");
    expect(auditCall?.[1]?.join(" ")).toContain("reviewSource");
  });

  it("cancels a duplicate guest payment without granting a second seat", async () => {
    configurePayment({ existing: [{ seat_number: "2001970" }] });
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).resolves.toMatchObject({ status: "cancelled", alreadyUnlocked: true });
    const statements = query.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => statement.includes("payment.cancelled_duplicate_seat"))).toBe(true);
    expect(statements.some((statement) => statement.includes("INSERT INTO seat_entitlements"))).toBe(false);
  });

  it("rejects without creating an entitlement", async () => {
    configurePayment();
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "reject", rejectionReason: "إيصال غير واضح" })).resolves.toMatchObject({ status: "rejected" });
    const statements = query.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => statement.includes("INSERT INTO seat_entitlements"))).toBe(false);
  });

  it("fails the whole friends approval when one entitlement insert races", async () => {
    let entitlementInserts = 0;
    query.mockImplementation(async (statement: unknown) => {
      const sql = String(statement ?? "");
      if (sql.includes("FROM payment_submissions")) return { rows: [{ id: "payment", status: "pending", user_id: null, saved_student_id: null, prediction_id: "prediction", year: 2026, seat_number: "2001970", product_type: "friends_3", receipt_blob_key: "receipts/private.webp" }] };
      if (sql.includes("FROM payment_submission_seats")) return { rows: ["2001970", "2001980", "2001990"].map((seat_number, index) => ({ year: 2026, seat_number, position: index + 1 })) };
      if (sql.includes("FROM seat_entitlements")) return { rows: [] };
      if (sql.includes("INSERT INTO seat_entitlements")) return { rowCount: ++entitlementInserts === 1 ? 1 : 0, rows: [] };
      return { rowCount: 1, rows: [] };
    });
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).rejects.toThrow("PAYMENT_REVIEW_RACE");
    expect(entitlementInserts).toBe(2);
  });

  it("treats an approval retry as an idempotent no-op", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "payment", status: "approved", user_id: "user", saved_student_id: "student", prediction_id: "prediction", year: 2026, seat_number: "2001970", product_type: "single", receipt_blob_key: "receipts/private.webp" }] });
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).resolves.toEqual({ status: "approved", idempotent: true });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

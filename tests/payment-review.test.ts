import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = vi.fn();
vi.mock("@/db/transaction", () => ({
  inNeonTransaction: async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }),
}));

import { reviewPaymentTransaction } from "@/lib/payment-review";

describe("payment review transaction", () => {
  beforeEach(() => query.mockReset());

  it("creates grant, annual entitlement, consume, and audit only after conditional approval", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: "payment", status: "pending", user_id: "user", saved_student_id: "student", prediction_id: "prediction", receipt_blob_key: "receipts/private.webp" }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).resolves.toEqual({ status: "approved", idempotent: false });
    const statements = query.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => statement.includes("event_type, units") && statement.includes("'grant', 1"))).toBe(true);
    expect(statements.some((statement) => statement.includes("prediction_entitlements"))).toBe(true);
    expect(statements.some((statement) => statement.includes("'consume', -1"))).toBe(true);
    expect(statements.some((statement) => statement.includes("admin_audit_logs"))).toBe(true);
  });

  it("treats an approval retry as an idempotent no-op", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "payment", status: "approved", user_id: "user", saved_student_id: "student", prediction_id: "prediction", receipt_blob_key: "receipts/private.webp" }] });
    await expect(reviewPaymentTransaction({ paymentId: "payment", actorUserId: "admin", action: "approve" })).resolves.toEqual({ status: "approved", idempotent: true });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

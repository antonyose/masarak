import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = vi.fn();
vi.mock("@/db/transaction", () => ({
  inNeonTransaction: async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }),
}));

import { grantManualSeatEntitlement } from "@/lib/manual-entitlement";

const base = {
  year: 2026 as const,
  seatNumber: "2537449",
  studentName: "طالب اختبار",
  recordRevenue: true,
  amount: 35,
  method: "vodafone_cash" as const,
  actorUserId: "admin",
};

describe("manual seat entitlement", () => {
  beforeEach(() => query.mockReset());

  it("creates an entitlement and a revenue-bearing manual grant atomically", async () => {
    query.mockImplementation(async (statement: unknown) => {
      const sql = String(statement ?? "");
      if (sql.includes("SELECT id FROM seat_entitlements")) return { rows: [] };
      if (sql.includes("INSERT INTO admin_manual_entitlement_grants")) return { rows: [{ id: "grant" }], rowCount: 1 };
      if (sql.includes("INSERT INTO seat_entitlements")) return { rows: [{ id: "entitlement" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await expect(grantManualSeatEntitlement(base)).resolves.toMatchObject({
      grantId: "grant",
      entitlementId: "entitlement",
      recordRevenue: true,
    });
    const grantCall = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO admin_manual_entitlement_grants"));
    expect(grantCall?.[1]).toContain(35);
    expect(query.mock.calls.some(([statement]) => String(statement).includes("entitlement.manual_grant"))).toBe(true);
  });

  it("stores zero revenue and no method for a free admin activation", async () => {
    query.mockImplementation(async (statement: unknown) => {
      const sql = String(statement ?? "");
      if (sql.includes("SELECT id FROM seat_entitlements")) return { rows: [] };
      if (sql.includes("INSERT INTO admin_manual_entitlement_grants")) return { rows: [{ id: "grant" }], rowCount: 1 };
      if (sql.includes("INSERT INTO seat_entitlements")) return { rows: [{ id: "entitlement" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await grantManualSeatEntitlement({ ...base, recordRevenue: false, amount: 99, method: "instapay" });
    const grantCall = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO admin_manual_entitlement_grants"));
    expect(grantCall?.[1]?.[4]).toBe(0);
    expect(grantCall?.[1]?.[5]).toBeNull();
  });

  it("fails closed when the seat is already unlocked", async () => {
    query.mockImplementation(async (statement: unknown) => String(statement).includes("SELECT id FROM seat_entitlements")
      ? { rows: [{ id: "existing" }] }
      : { rows: [], rowCount: 1 });
    await expect(grantManualSeatEntitlement(base)).rejects.toThrow("SEAT_ALREADY_UNLOCKED");
    expect(query.mock.calls.some(([statement]) => String(statement).includes("INSERT INTO admin_manual_entitlement_grants"))).toBe(false);
  });
});

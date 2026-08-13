import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock("@/db/client", () => ({ getDatabase }));

import { getSeatEntitlement } from "@/lib/authz";

describe("getSeatEntitlement", () => {
  it("selects only baseline entitlement columns needed by public predictions", async () => {
    const limit = vi.fn().mockResolvedValue([null]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    getDatabase.mockReturnValue({ select });

    await expect(getSeatEntitlement({ year: 2026, seatNumber: "2537449" })).resolves.toBeNull();
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ paymentId: expect.anything() }));
    expect(from).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});

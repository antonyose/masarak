import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const select = vi.fn();
vi.mock("@/db/client", () => ({
  getDatabase: () => ({ select }),
}));

import { getSeatPaymentState } from "@/lib/payment-state";

function chain(result: unknown[]) {
  const value = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  value.from.mockReturnValue(value);
  value.where.mockReturnValue(value);
  value.orderBy.mockReturnValue(value);
  return value;
}

describe("public seat payment state", () => {
  beforeEach(() => select.mockReset());

  it("returns unlocked when a seat entitlement exists", async () => {
    select.mockImplementationOnce(() => chain([{ paymentId: "payment" }]));
    await expect(getSeatPaymentState({ year: 2026, seatNumber: "2001970" })).resolves.toEqual({
      status: "unlocked",
      paymentId: "payment",
    });
  });

  it("returns pending only for a payment awaiting review", async () => {
    select
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([{ id: "payment", status: "pending", receiptBlobKey: "private/key" }]));
    await expect(getSeatPaymentState({ year: 2026, seatNumber: "2001970" })).resolves.toEqual({
      status: "pending",
      paymentId: "payment",
      hasReceipt: true,
    });
  });

  it("keeps rejected and unpaid seats locked", async () => {
    select
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([{ id: "payment", status: "rejected", receiptBlobKey: null }]));
    await expect(getSeatPaymentState({ year: 2026, seatNumber: "2001970" })).resolves.toEqual({
      status: "rejected",
      paymentId: "payment",
    });

    select
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([]));
    await expect(getSeatPaymentState({ year: 2026, seatNumber: "2001980" })).resolves.toEqual({ status: "none" });
  });
});

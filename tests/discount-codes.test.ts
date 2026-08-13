import { describe, expect, it } from "vitest";
import { calculateDiscount } from "@/lib/discount-math";
import { adminDiscountCodeCreateSchema, discountCodeSchema, paymentCreateSchema } from "@/lib/schemas";

describe("discount code pricing", () => {
  it("calculates a percentage discount to two decimal places", () => {
    expect(calculateDiscount(35, "percentage", 25)).toEqual({ originalAmount: 35, discountAmount: 8.75, finalAmount: 26.25 });
  });

  it("caps a fixed discount at the product price", () => {
    expect(calculateDiscount(35, "fixed", 100)).toEqual({ originalAmount: 35, discountAmount: 35, finalAmount: 0 });
  });

  it("allows a full percentage discount", () => {
    expect(calculateDiscount(69, "percentage", 100).finalAmount).toBe(0);
  });

  it("normalizes safe four-character codes", () => {
    expect(discountCodeSchema.parse("a1b2")).toBe("A1B2");
    expect(discountCodeSchema.safeParse("ABC").success).toBe(false);
    expect(discountCodeSchema.safeParse("AB-2").success).toBe(false);
  });

  it("rejects percentage values over 100", () => {
    expect(adminDiscountCodeCreateSchema.safeParse({ discountType: "percentage", discountValue: 101, maxRedemptions: 50 }).success).toBe(false);
  });

  it("accepts the code on a normal payment request", () => {
    expect(paymentCreateSchema.safeParse({ predictionId: "4de1b30c-8dae-4af4-a5bb-40bd259f6c69", year: 2026, productType: "single", seatNumbers: ["2537449"], method: "vodafone_cash", idempotencyKey: "1632804b-42e1-49b8-b6a0-78f7eece2bc4", discountCode: "A1B2" }).success).toBe(true);
  });
});

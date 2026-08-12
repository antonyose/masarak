import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSeatEntitlement, getPaymentSettings, findTursoResultBySeat } = vi.hoisted(() => ({
  getSeatEntitlement: vi.fn(),
  getPaymentSettings: vi.fn(),
  findTursoResultBySeat: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getSeatEntitlement }));
vi.mock("@/lib/settings", () => ({ getPaymentSettings }));
vi.mock("@/lib/turso", () => ({ findTursoResultBySeat }));

import { getPaymentProduct, validatePaymentSeats } from "@/lib/payment-products";

const settings = {
  id: 1,
  fullReportPriceEgp: "99.00",
  singleReportPriceEgp: "35.00",
  singleReportOriginalPriceEgp: "50.00",
  friends3PriceEgp: "69.00",
  friends3Enabled: true,
  autoAcceptPayments: false,
  offerEnabled: true,
  offerTargetProduct: "single" as const,
  offerBadgeText: "عرض لفترة محدودة",
  offerTitle: "عرض التقرير الفردي",
  offerSubtitle: "افتح تقريرك الكامل بسعر خاص",
  offerCtaText: "استفد من العرض",
  offerEndAt: new Date(Date.now() + 86400000),
  offerShowCountdown: true,
  offerShowInHeader: true,
  offerShowInPricingCard: true,
  offerShowInLockedOffer: true,
  vodafoneCashNumber: "01001014231",
  vodafoneDeepLink: "http://vf.eg/vfcash?id=mt&qrId=hpSxBH",
  vodafoneEnabled: true,
  orangeCashNumber: "01276101944",
  orangeEnabled: true,
  instapayIdentifier: "01276101944",
  instapayEnabled: true,
  paymentInstructions: "حوّل ثم ارفع الإيصال.",
  supportContact: "+201276101944",
  freeRecommendationCount: 1,
  homepageStageMessage: "محدثة بعد المرحلة الأولى.",
  updatedBy: null,
  updatedAt: new Date(),
};

describe("seat payment products", () => {
  it("uses one seat and 35 جنيه for the individual product", () => {
    expect(getPaymentProduct(settings, "single")).toEqual({ id: "single", priceEgp: "35.00", seatCount: 1 });
  });

  it("uses three seats and 69 جنيه for the friends product", () => {
    expect(getPaymentProduct(settings, "friends_3")).toEqual({ id: "friends_3", priceEgp: "69.00", seatCount: 3 });
  });

  it("rejects duplicate, missing, and already-unlocked friend seats", async () => {
    getPaymentSettings.mockResolvedValue(settings);
    findTursoResultBySeat.mockResolvedValue({ seatNumber: "ok" });
    getSeatEntitlement.mockResolvedValue(null);
    await expect(validatePaymentSeats({ year: 2026, productType: "friends_3", seatNumbers: ["١", "1", "2"] })).rejects.toThrow("DUPLICATE_PAYMENT_SEATS");

    findTursoResultBySeat.mockImplementation(async (_year: number, seat: string) => seat === "2001990" ? null : { seatNumber: seat });
    await expect(validatePaymentSeats({ year: 2026, productType: "friends_3", seatNumbers: ["2001970", "2001980", "2001990"] })).rejects.toThrow("PAYMENT_SEAT_NOT_FOUND");

    findTursoResultBySeat.mockResolvedValue({ seatNumber: "ok" });
    getSeatEntitlement.mockImplementation(async ({ seatNumber }: { seatNumber: string }) => seatNumber === "2001980" ? { id: "entitlement" } : null);
    await expect(validatePaymentSeats({ year: 2026, productType: "friends_3", seatNumbers: ["2001970", "2001980", "2001990"] })).resolves.toMatchObject({ unlockedSeats: ["2001980"] });
  });
});

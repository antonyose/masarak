import { describe, expect, it } from "vitest";
import { formatOfferCountdown, isOfferActive, type PublicOffer } from "@/lib/offer-config";

const baseOffer: PublicOffer = {
  enabled: true,
  active: true,
  targetProduct: "single",
  badgeText: "عرض لفترة محدودة",
  title: "عرض التقرير الفردي",
  subtitle: "افتح تقريرك الكامل بسعر خاص",
  ctaText: "استفد من العرض",
  endAt: "2026-08-12T12:00:00.000Z",
  showCountdown: true,
  showInHeader: true,
  showInPricingCard: true,
  showInLockedOffer: true,
};

describe("public offer presentation", () => {
  it("keeps an enabled offer active until its end time", () => {
    expect(isOfferActive(baseOffer, Date.parse("2026-08-12T11:59:59.000Z"))).toBe(true);
    expect(isOfferActive(baseOffer, Date.parse("2026-08-12T12:00:00.000Z"))).toBe(false);
  });

  it("disables an offer when the admin turns it off", () => {
    expect(isOfferActive({ ...baseOffer, enabled: false }, Date.parse("2026-08-12T11:00:00.000Z"))).toBe(false);
  });

  it("formats a stable zero-padded countdown", () => {
    expect(formatOfferCountdown(baseOffer.endAt, Date.parse("2026-08-12T10:58:42.000Z"))).toBe("01:01:18");
    expect(formatOfferCountdown(baseOffer.endAt, Date.parse("2026-08-12T12:00:01.000Z"))).toBe("00:00:00");
  });
});

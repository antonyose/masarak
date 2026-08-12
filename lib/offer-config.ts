export type OfferProduct = "single" | "friends_3";

export type PublicOffer = {
  enabled: boolean;
  active: boolean;
  targetProduct: OfferProduct | null;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaText: string;
  endAt: string | null;
  showCountdown: boolean;
  showInHeader: boolean;
  showInPricingCard: boolean;
  showInLockedOffer: boolean;
};

export function isOfferActive(offer: PublicOffer, now = Date.now()) {
  if (!offer.enabled || !offer.active) return false;
  if (!offer.endAt) return true;
  const endAt = Date.parse(offer.endAt);
  return Number.isFinite(endAt) && endAt > now;
}

export function formatOfferCountdown(endAt: string | null, now = Date.now()) {
  if (!endAt) return null;
  const remaining = Math.max(0, Date.parse(endAt) - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

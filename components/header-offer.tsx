"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, Sparkles } from "lucide-react";
import { formatOfferCountdown, isOfferActive, type PublicOffer } from "@/lib/offer-config";

type HeaderOfferSettings = {
  offer: PublicOffer;
  products: {
    single: { priceEgp: string };
    friends3: { priceEgp: string; enabled: boolean };
  };
};

export function HeaderOffer() {
  const [settings, setSettings] = useState<HeaderOfferSettings | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/payment-settings", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) setSettings(await response.json());
      })
      .catch(() => undefined);
  }, []);

  const offer = settings?.offer;
  const active = offer ? isOfferActive(offer, now) : false;
  useEffect(() => {
    if (!offer?.endAt || !offer.showCountdown || !active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, offer?.endAt, offer?.showCountdown]);

  if (!settings || !offer || !offer.targetProduct || !offer.showInHeader || !active) return null;
  const targetPrice = offer.targetProduct === "friends_3" ? settings.products.friends3.priceEgp : settings.products.single.priceEgp;
  const targetLabel = offer.targetProduct === "friends_3" ? "عرض الصحاب" : "عرض التقرير";
  const countdown = offer.showCountdown ? formatOfferCountdown(offer.endAt, now) : null;
  const targetProduct = offer.targetProduct;

  function openOffer() {
    if (targetProduct) window.dispatchEvent(new CustomEvent("masarak-product-select", { detail: targetProduct }));
    document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <button type="button" className="header-offer" onClick={openOffer} aria-label={`${offer.title} — ${offer.ctaText}`}>
      <span className="header-offer-icon"><Sparkles size={14} aria-hidden="true" /></span>
      <span className="header-offer-copy">
        <strong>{offer.badgeText || targetLabel} · <bdi>{targetPrice}</bdi> جنيه</strong>
        <span>{offer.ctaText}</span>
      </span>
      {countdown ? <span className="header-offer-countdown"><Clock3 size={13} aria-hidden="true" /><bdi>{countdown}</bdi></span> : null}
      <ArrowLeft className="header-offer-arrow" size={15} aria-hidden="true" />
    </button>
  );
}

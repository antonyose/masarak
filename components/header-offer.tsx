"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import { formatEgp, getServerBasedNow, isOfferActive, type PublicOffer } from "@/lib/offer-config";
import { OfferCountdown } from "@/components/offer-countdown";

type HeaderOfferSettings = {
  serverNow: string;
  receivedAt: number;
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
        if (response.ok) setSettings({ ...(await response.json()), receivedAt: Date.now() });
      })
      .catch(() => undefined);
  }, []);

  const offer = settings?.offer;
  const active = offer ? isOfferActive(offer, getServerBasedNow(settings?.serverNow, settings?.receivedAt ?? now, now)) : false;
  useEffect(() => {
    if (!offer?.endAt || !offer.showCountdown || !active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, offer?.endAt, offer?.showCountdown]);

  if (!settings || !offer || !offer.targetProduct || !offer.showInHeader || !active) return null;
  const targetPrice = offer.targetProduct === "friends_3" ? settings.products.friends3.priceEgp : settings.products.single.priceEgp;
  const targetLabel = offer.targetProduct === "friends_3" ? "عرض الصحاب" : "عرض التقرير";
  const targetProduct = offer.targetProduct;

  function openOffer() {
    if (targetProduct) window.dispatchEvent(new CustomEvent("masarak-product-select", { detail: targetProduct }));
    document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <button type="button" className="header-offer" onClick={openOffer} aria-label={`${offer.title} — ${offer.ctaText}`}>
      <span className="header-offer-icon"><Clock3 size={15} aria-hidden="true" /></span>
      <span className="header-offer-copy">
        <strong>{offer.badgeText || targetLabel}</strong>
        <span>عرض {formatEgp(targetPrice)} جنيه</span>
      </span>
      {offer.showCountdown ? <OfferCountdown endAt={offer.endAt} serverNow={settings.serverNow} receivedAt={settings.receivedAt} compact className="header-offer-countdown" /> : null}
      <ArrowLeft className="header-offer-arrow" size={15} aria-hidden="true" />
    </button>
  );
}

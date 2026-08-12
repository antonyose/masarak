"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock3, Sparkles } from "lucide-react";
import { formatOfferCountdown, isOfferActive, type PublicOffer } from "@/lib/offer-config";

type ProductType = "single" | "friends_3";
type PricingSettings = {
  offer: PublicOffer;
  products: {
    single: { priceEgp: string; offer: { badgeText: string; title: string; subtitle: string; ctaText: string; endAt: string | null; showCountdown: boolean } | null };
    friends3: { priceEgp: string; enabled: boolean; regularTotalEgp: string; savingsEgp: string; offer: { badgeText: string; title: string; subtitle: string; ctaText: string; endAt: string | null; showCountdown: boolean } | null };
  };
};

export function PricingSection() {
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductType>("single");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/payment-settings", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) setSettings(await response.json());
      })
      .catch(() => undefined);
  }, []);

  const activeOffer = settings ? isOfferActive(settings.offer, now) : false;
  useEffect(() => {
    if (!settings) return;
    const preferred = activeOffer && settings.offer.targetProduct === "friends_3" && settings.products.friends3.enabled ? "friends_3" : "single";
    setSelectedProduct(preferred);
  }, [activeOffer, settings]);
  useEffect(() => {
    const selectProduct = (event: Event) => {
      const product = (event as CustomEvent<ProductType>).detail;
      if (product === "single" || product === "friends_3") setSelectedProduct(product);
    };
    window.addEventListener("masarak-product-select", selectProduct);
    return () => window.removeEventListener("masarak-product-select", selectProduct);
  }, []);
  useEffect(() => {
    if (!settings?.offer.endAt || !settings.offer.showCountdown || !activeOffer) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeOffer, settings?.offer.endAt, settings?.offer.showCountdown]);

  function choose(product: ProductType) {
    setSelectedProduct(product);
    window.dispatchEvent(new CustomEvent("masarak-product-select", { detail: product }));
    document.getElementById("prediction-tool")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!settings) return null;
  const countdown = activeOffer && settings.offer.showCountdown ? formatOfferCountdown(settings.offer.endAt, now) : null;
  const singleOffer = activeOffer && settings.offer.targetProduct === "single" && settings.offer.showInPricingCard;
  const friendsOffer = activeOffer && settings.offer.targetProduct === "friends_3" && settings.offer.showInPricingCard;

  return (
    <section id="pricing-section" className="pricing-section" aria-label="اختيارات التقرير">
      <div className="shell">
        <div className="pricing-cards">
          <article className={`pricing-card${selectedProduct === "single" ? " is-selected" : ""}${singleOffer ? " has-offer" : ""}`}>
            {singleOffer ? <span className="pricing-badge pricing-badge-offer"><Sparkles size={13} aria-hidden="true" />{settings.offer.badgeText}</span> : null}
            {selectedProduct === "single" ? <span className="pricing-selected"><Check size={13} aria-hidden="true" /> محدد الآن</span> : null}
            <button type="button" className="pricing-card-select" onClick={() => setSelectedProduct("single")} aria-pressed={selectedProduct === "single"}>
              <span className="pricing-card-label">تقريرك</span>
              <strong><bdi>{settings.products.single.priceEgp}</bdi> <small>جنيه فقط</small></strong>
              <p>تقرير كامل لرقم جلوس واحد</p>
              {singleOffer ? <><span className="pricing-offer-title">{settings.offer.title}</span><span className="pricing-offer-copy">{settings.offer.subtitle}</span></> : null}
              {singleOffer && countdown ? <span className="pricing-countdown"><Clock3 size={14} aria-hidden="true" /> ينتهي خلال <bdi>{countdown}</bdi></span> : null}
            </button>
            <button type="button" className="pricing-card-cta" onClick={() => choose("single")}>
              {singleOffer ? settings.offer.ctaText : "افتح تقريري"} <ArrowLeft size={17} aria-hidden="true" />
            </button>
          </article>

          {settings.products.friends3.enabled ? (
            <article className={`pricing-card pricing-card-featured${selectedProduct === "friends_3" ? " is-selected" : ""}${friendsOffer ? " has-offer" : ""}`}>
              <span className="pricing-badge">الأوفر 🔥</span>
              {selectedProduct === "friends_3" ? <span className="pricing-selected"><Check size={13} aria-hidden="true" /> محدد الآن</span> : null}
              <button type="button" className="pricing-card-select" onClick={() => setSelectedProduct("friends_3")} aria-pressed={selectedProduct === "friends_3"}>
                <span className="pricing-card-label">إنت و2 من صحابك</span>
                <strong><bdi>{settings.products.friends3.priceEgp}</bdi> <small>جنيه</small></strong>
                <p>3 تقارير كاملة · بدل {settings.products.friends3.regularTotalEgp} جنيه</p>
                {friendsOffer ? <span className="pricing-offer-title">{settings.offer.title}</span> : null}
                <span className="pricing-saving"><Check size={14} aria-hidden="true" /> وفّر {settings.products.friends3.savingsEgp} جنيه</span>
              </button>
              <button type="button" className="pricing-card-cta" onClick={() => choose("friends_3")}>
                {friendsOffer ? settings.offer.ctaText : "وفر مع صحابك"} <ArrowLeft size={17} aria-hidden="true" />
              </button>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

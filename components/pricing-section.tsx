"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileCheck2, Sparkles, UsersRound } from "lucide-react";
import { OfferCountdown } from "@/components/offer-countdown";
import { useTrackFunnel } from "@/components/analytics-tracker";
import { formatEgp, getServerBasedNow, isOfferActive, type PublicOffer } from "@/lib/offer-config";

type ProductType = "single" | "friends_3";
type PricingSettings = {
  serverNow: string;
  receivedAt: number;
  offer: PublicOffer;
  products: {
    single: {
      priceEgp: string;
      originalPriceEgp: string;
      savingsEgp: string;
    };
    friends3: {
      priceEgp: string;
      enabled: boolean;
      regularTotalEgp: string;
      savingsEgp: string;
    };
  };
};

export function PricingSection() {
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/payment-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        setSettings({ ...payload, receivedAt: Date.now() });
      })
      .catch(() => undefined);
  }, []);

  const activeOffer = settings
    ? isOfferActive(settings.offer, getServerBasedNow(settings.serverNow, settings.receivedAt, now))
    : false;

  useEffect(() => {
    if (!settings?.offer.endAt || !settings.offer.showCountdown || !activeOffer) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeOffer, settings?.offer.endAt, settings?.offer.showCountdown]);

  const trackFunnel = useTrackFunnel();

  useEffect(() => {
    const section = document.getElementById("pricing-section");
    if (!section) return;
    let tracked = false;
    const observer = new IntersectionObserver((entries) => {
      if (!tracked && entries.some((entry) => entry.isIntersecting)) {
        tracked = true;
        trackFunnel("pricing_opened", { source: "pricing_section" });
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [settings, trackFunnel]);

  function choose(product: ProductType) {
    trackFunnel("pricing_cta_clicked", { product, source: "pricing_section" });
    window.dispatchEvent(new CustomEvent("masarak-product-select", { detail: product }));
    document.getElementById("prediction-tool")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!settings) return null;
  const singleOffer = activeOffer && settings.offer.targetProduct === "single" && settings.offer.showInPricingCard;
  const friendsOffer = activeOffer && settings.offer.targetProduct === "friends_3" && settings.offer.showInPricingCard;

  return (
    <section id="pricing-section" className="pricing-section" aria-label="اختيارات التقرير">
      <div className="shell">
        <div className="pricing-cards">
          <article className={`pricing-card pricing-card-single${singleOffer ? " has-offer" : ""}`}>
            <div className="pricing-card-topline">
              {singleOffer ? <span className="pricing-badge pricing-badge-offer"><Sparkles size={14} aria-hidden="true" /> {settings.offer.badgeText}</span> : null}
            </div>
            <div className="pricing-card-main">
              <div className="pricing-card-copy">
                <h3>تقريرك الكامل</h3>
                <div className="pricing-price"><strong><bdi>{formatEgp(settings.products.single.priceEgp)}</bdi></strong><span>جنيه فقط</span></div>
                {singleOffer ? <div className="pricing-original">بدل <s><bdi>{formatEgp(settings.products.single.originalPriceEgp)}</bdi></s> جنيه</div> : null}
                {singleOffer ? <span className="pricing-saving"><span>وفر</span> <bdi>{formatEgp(settings.products.single.savingsEgp)}</bdi> جنيه</span> : null}
              </div>
              <span className="pricing-card-art pricing-card-art-single" aria-hidden="true"><FileCheck2 size={58} strokeWidth={1.45} /></span>
            </div>
            <span className="pricing-benefit">كل الترشيحات المناسبة لرقم جلوسك</span>
            {singleOffer && settings.offer.showCountdown ? <OfferCountdown endAt={settings.offer.endAt} serverNow={settings.serverNow} receivedAt={settings.receivedAt} className="pricing-countdown" /> : null}
            <button type="button" className="pricing-card-cta" onClick={() => choose("single")}>
              {singleOffer ? `${settings.offer.ctaText} بـ${formatEgp(settings.products.single.priceEgp)} جنيه` : "افتح تقريري"} <ArrowLeft size={18} aria-hidden="true" />
            </button>
          </article>

          {settings.products.friends3.enabled ? (
            <article className={`pricing-card pricing-card-friends${friendsOffer ? " has-offer" : ""}`}>
              <div className="pricing-card-topline"><span className="pricing-badge pricing-badge-friends">الأوفر 🔥</span></div>
              <div className="pricing-card-main">
                <div className="pricing-card-copy">
                  <h3>إنت و2 من صحابك</h3>
                  <div className="pricing-price"><strong><bdi>{formatEgp(settings.products.friends3.priceEgp)}</bdi></strong><span>جنيه</span></div>
                  <div className="pricing-original">بدل <s><bdi>{formatEgp(settings.products.friends3.regularTotalEgp)}</bdi></s> جنيه</div>
                  <span className="pricing-saving"><span>وفر</span> <bdi>{formatEgp(settings.products.friends3.savingsEgp)}</bdi> جنيه</span>
                </div>
                <span className="pricing-card-art pricing-card-art-friends" aria-hidden="true"><UsersRound size={58} strokeWidth={1.45} /></span>
              </div>
              <span className="pricing-benefit">3 تقارير كاملة</span>
              {friendsOffer && settings.offer.showCountdown ? <OfferCountdown endAt={settings.offer.endAt} serverNow={settings.serverNow} receivedAt={settings.receivedAt} className="pricing-countdown" /> : null}
              <button type="button" className="pricing-card-cta pricing-card-cta-warm" onClick={() => choose("friends_3")}>
                {friendsOffer ? `${settings.offer.ctaText} بـ${formatEgp(settings.products.friends3.priceEgp)} جنيه` : `افتح 3 تقارير بـ${formatEgp(settings.products.friends3.priceEgp)} جنيه`} <ArrowLeft size={18} aria-hidden="true" />
              </button>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

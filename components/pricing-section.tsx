"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

type PricingSettings = {
  products: {
    single: { priceEgp: string };
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

  useEffect(() => {
    void fetch("/api/payment-settings", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) setSettings(await response.json());
      })
      .catch(() => undefined);
  }, []);

  function choose(product: "single" | "friends_3") {
    window.dispatchEvent(new CustomEvent("masarak-product-select", { detail: product }));
    document.getElementById("prediction-tool")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!settings) return null;
  return (
    <section className="pricing-section" aria-labelledby="pricing-title">
      <div className="shell">
        <div className="pricing-heading">
          <span className="pricing-kicker"><Sparkles size={15} aria-hidden="true" /> عروض بسيطة وواضحة</span>
          <h2 id="pricing-title">اختار اللي يناسبك</h2>
          <p>افتح تقريرك لوحدك أو وفر مع صحابك</p>
        </div>
        <div className="pricing-cards">
          <article className="pricing-card">
            <span className="pricing-card-label">تقريرك</span>
            <strong><bdi>{settings.products.single.priceEgp}</bdi> جنيه</strong>
            <p>تقرير كامل لرقم جلوس واحد</p>
            <button type="button" onClick={() => choose("single")}>
              افتح تقريري <ArrowLeft size={17} aria-hidden="true" />
            </button>
          </article>
          {settings.products.friends3.enabled ? (
            <article className="pricing-card pricing-card-featured">
              <span className="pricing-badge">الأوفر 🔥</span>
              <span className="pricing-card-label">إنت و2 من صحابك</span>
              <strong><bdi>{settings.products.friends3.priceEgp}</bdi> جنيه</strong>
              <p>3 تقارير كاملة · بدل {settings.products.friends3.regularTotalEgp} جنيه</p>
              <small><Check size={14} aria-hidden="true" /> وفر {settings.products.friends3.savingsEgp} جنيه</small>
              <button type="button" onClick={() => choose("friends_3")}>
                وفر مع صحابك <ArrowLeft size={17} aria-hidden="true" />
              </button>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

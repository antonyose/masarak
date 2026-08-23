import Image from "next/image";
import { PricingSection } from "@/components/pricing-section";
import { ToolExperience } from "@/components/tool-experience";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-backdrop" aria-hidden="true">
          <Image
            src="/images/masarak-hero-v2.webp"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="shell hero-inner">
          <div className="hero-content">
            <span className="hero-stage-note">
              شواغر المرحلة الثالثة منشورة رسميًا · التوقع الآن للحد النهائي فقط
            </span>
            <h1>
              اعرف
              <span> أقرب كلياتك</span>
            </h1>
            <p className="hero-copy">
              اكتب رقم جلوسك وشوف أقرب اختيارات المرحلة الثالثة المتاحة رسميًا لمجموعك.
            </p>
          </div>
        </div>
      </section>

      <section id="prediction-tool" className="tool-stage" aria-label="توقعات تنسيق 2026">
        <div className="shell">
          <ToolExperience />
        </div>
      </section>
      <PricingSection />
    </>
  );
}

import Image from "next/image";
import { MessageCircle, Code2 } from "lucide-react";
import { ToolExperience } from "@/components/tool-experience";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getPaymentSettings();
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
            <h1>
              اعرف
              <span> نتيجتك وكلياتك الأقرب</span>
            </h1>
            <p className="hero-copy">
              ابحث عن نتيجتك أو أدخل مجموعك لتشوف أقرب الخيارات لمجموعك
              ومحافظتك.
            </p>
            <p className="mt-4 inline-flex border border-white/30 bg-slate-950/30 px-3 py-2 text-sm font-bold text-white">
              {settings.homepageStageMessage}
            </p>
          </div>
        </div>
      </section>

      <section className="tool-stage" aria-label="أدوات النتيجة والتوقع">
        <div className="shell">
          <ToolExperience />
        </div>
      </section>

      <section className="dev-contact-strip">
        <div className="shell">
          <div className="dev-contact-card">
            <div className="dev-contact-info">
              <span className="dev-badge">
                <Code2 size={15} aria-hidden="true" />
                تطوير المواقع والتطبيقات والأنظمة
              </span>
              <p>
                لتصميم وتطوير مواقع الإنترنت، تطبيقات الموبايل، والأنظمة الخاصة بعملك أو شركتك — تواصل مباشرة مع المطور:
              </p>
            </div>
            <a
              href="https://wa.me/201276101944"
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-contact-btn"
            >
              <MessageCircle size={18} aria-hidden="true" />
              تواصل عبر WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

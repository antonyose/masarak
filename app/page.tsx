import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Database,
  Landmark,
  Scale,
} from "lucide-react";
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
            <h1>
              اعرف
              <span> نتيجتك وكلياتك الأقرب</span>
            </h1>
            <p className="hero-copy">
              ابحث عن نتيجتك أو أدخل مجموعك لتشوف أقرب الخيارات لمجموعك
              ومحافظتك.
            </p>
          </div>
        </div>
      </section>

      <section className="tool-stage" aria-label="أدوات النتيجة والتوقع">
        <div className="shell">
          <ToolExperience />
        </div>
      </section>

      <section className="method-strip">
        <div className="shell">
          <div className="section-heading">
            <div>
              <h2>توقع مبني على ترتيبك، لا على رقم منفرد</h2>
              <p>
                لأن النهاية العظمى تغيّرت من 410 إلى 320، نستخدم موقع الطالب
                داخل توزيع درجات سنته حتى تكون المقارنة أكثر عدلًا.
              </p>
            </div>
            <Link className="text-link" href="/methodology">
              اقرأ المنهجية كاملة ←
            </Link>
          </div>

          <div className="method-flow">
            <article className="method-step">
              <span className="step-number">1</span>
              <h3>نحدد موقع مجموعك</h3>
              <p>
                نحسب عدد الطلاب الأعلى منك داخل السنة والنظام والشعبة نفسها.
              </p>
            </article>
            <article className="method-step">
              <span className="step-number">2</span>
              <h3>نوحّد المقارنة</h3>
              <p>
                نحوّل الحدود التاريخية إلى ترتيب نسبي بدل مقارنة الدرجات الخام.
              </p>
            </article>
            <article className="method-step">
              <span className="step-number">3</span>
              <h3>نعرض نطاقًا لا ضمانًا</h3>
              <p>
                نصنّف الخيارات إلى طموحة ومناسبة وآمنة مع مستوى ثقة واضح.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="guides">
        <div className="shell">
          <div className="section-heading">
            <div>
              <h2>معلومات تساعدك قبل تسجيل الرغبات</h2>
              <p>
                تعرّف على مصدر الأرقام وطريقة قراءة التوقع وحدود استخدامه.
              </p>
            </div>
          </div>

          <div className="guide-list">
            <article className="guide-item">
              <div>
                <Landmark size={26} aria-hidden="true" />
                <h3>دليل الكليات والجامعات</h3>
                <p>
                  استكشف القطاعات والكليات حسب الجامعة والمحافظة والشعبة.
                </p>
              </div>
              <Link href="/faculties">
                افتح الدليل <ArrowLeft size={14} aria-hidden="true" />
              </Link>
            </article>
            <article className="guide-item">
              <div>
                <Database size={24} aria-hidden="true" />
                <h3>مصادر البيانات</h3>
                <p>
                  السنوات المستخدمة، نطاق التغطية، وما نفعله عند نقص أي حقل.
                </p>
              </div>
              <Link href="/data-sources">راجع المصادر ←</Link>
            </article>
            <article className="guide-item">
              <div>
                <Scale size={24} aria-hidden="true" />
                <h3>حدود التوقع</h3>
                <p>
                  لماذا تتغير الحدود النهائية، ومتى يجب اعتبار الثقة منخفضة.
                </p>
              </div>
              <Link href="/disclaimer">اقرأ التنبيه ←</Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-top">
        <div className="footer-brand">
          <div className="footer-brand-lockup">
            <span className="brand-mark brand-mark-footer" aria-hidden="true">
              <BrandMark />
            </span>
            <div className="brand-copy">
              <strong>مسارك</strong>
              <small>من نتيجتك لاختيار أقرب</small>
            </div>
          </div>
          <p>
            منصة مستقلة تساعد طلاب الثانوية العامة على قراءة نتائجهم واستكشاف
            خيارات الكليات اعتمادًا على البيانات المتاحة.
          </p>
        </div>

        <div className="footer-links">
          <div>
            <h3>الأدوات</h3>
            <Link href="/result-search">اعرف نتيجتك</Link>
            <Link href="/predict">اعرف الكليات المتوقعة</Link>
            <Link href="/faculties">دليل الكليات</Link>
          </div>
          <div>
            <h3>الشفافية</h3>
            <Link href="/methodology">منهجية التوقع</Link>
            <Link href="/data-sources">مصادر البيانات</Link>
            <Link href="/disclaimer">إخلاء المسؤولية</Link>
          </div>
          <div>
            <h3>قانوني</h3>
            <Link href="/privacy">الخصوصية</Link>
            <Link href="/terms">شروط الاستخدام</Link>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 مسارك. جميع الحقوق محفوظة.</span>
        <span>منصة مستقلة وغير تابعة لوزارة التربية والتعليم أو مكتب التنسيق.</span>
      </div>
    </footer>
  );
}

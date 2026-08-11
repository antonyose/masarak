import Link from "next/link";
import { Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AuthButton } from "@/components/auth-button";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="مسارك — الصفحة الرئيسية">
          <span className="brand-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="brand-copy">
            <span>مسارك</span>
            <small>من نتيجتك لاختيار أقرب</small>
          </span>
        </Link>

        <nav className="nav-links" aria-label="التنقل الرئيسي">
          <Link href="/predict">توقع الكليات</Link>
          <Link href="/result-search">البحث عن النتيجة</Link>
          <Link href="/faculties">دليل الكليات</Link>
          <Link href="/methodology">كيف نحسب التوقعات؟</Link>
        </nav>

        <div className="flex items-center gap-3">
          <AuthButton />
          <Link className="header-cta" href="/result-search">
            <Search size={17} aria-hidden="true" />
            <span>ابحث عن نتيجتك</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

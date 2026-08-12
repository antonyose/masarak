import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { HeaderOffer } from "@/components/header-offer";

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
            <small>توقعات تنسيق 2026</small>
          </span>
        </Link>

        <nav className="nav-links" aria-label="التنقل الرئيسي">
          <Link href="/predict">توقع الكليات</Link>
          <Link href="/faculties">دليل الكليات</Link>
          <Link href="/methodology">طريقة الحساب</Link>
        </nav>

        <HeaderOffer />

      </div>
    </header>
  );
}

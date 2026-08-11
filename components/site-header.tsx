import Link from "next/link";
import { Sparkles } from "lucide-react";
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
            <small>توقعات تنسيق 2026</small>
          </span>
        </Link>

        <nav className="nav-links" aria-label="التنقل الرئيسي">
          <Link href="/predict">توقع الكليات</Link>
          <Link href="/faculties">دليل الكليات</Link>
          <Link href="/methodology">طريقة الحساب</Link>
        </nav>

        <div className="flex items-center gap-3">
          <AuthButton />
          <Link className="header-cta" href="/predict">
            <Sparkles size={17} aria-hidden="true" />
            <span>ابدأ برقم جلوسك</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

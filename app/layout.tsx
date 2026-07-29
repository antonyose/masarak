import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "مسارك | نتيجة الثانوية العامة وتوقع الكليات",
    template: "%s | مسارك",
  },
  description:
    "ابحث عن نتيجة الثانوية العامة واستكشف الكليات الأقرب لمجموعك ومحافظتك بتوقعات مبنية على بيانات السنوات السابقة.",
  applicationName: "مسارك",
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#123b56",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

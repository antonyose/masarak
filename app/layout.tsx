import type { Metadata, Viewport } from "next";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://masarak.live"),
  title: {
    default: "مسارك | توقعات تنسيق 2026",
    template: "%s | مسارك",
  },
  description:
    "اكتب رقم جلوسك واعرف أقرب اختيارات المرحلة الثالثة المتاحة رسميًا في تنسيق 2026.",
  applicationName: "مسارك",
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "مسارك | توقعات تنسيق 2026",
    description:
      "اعرف أقرب اختيارات المرحلة الثالثة المتاحة رسميًا برقم الجلوس.",
    url: "https://masarak.live",
    siteName: "مسارك",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/images/masarak-hero-v2.webp",
        width: 1200,
        height: 630,
        alt: "مسارك - توقعات تنسيق 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "مسارك | توقعات تنسيق 2026",
    description:
      "اعرف أقرب اختيارات المرحلة الثالثة المتاحة رسميًا برقم الجلوس.",
    images: ["/images/masarak-hero-v2.webp"],
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
        <AnalyticsTracker />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

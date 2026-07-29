import type { Metadata, Viewport } from "next";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://masarak.live"),
  title: {
    default: "مسارك | نتيجة الثانوية العامة وتوقع الكليات",
    template: "%s | مسارك",
  },
  description:
    "من نتيجتك لأقرب اختيار. ابحث عن نتيجة الثانوية العامة برقم الجلوس أو الاسم واستكشف الكليات الأقرب لمجموعك ومحافظتك بتوقعات دقيقة.",
  applicationName: "مسارك",
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "مسارك | نتيجة الثانوية العامة وتوقع الكليات",
    description:
      "من نتيجتك لأقرب اختيار. ابحث عن نتيجة الثانوية العامة برقم الجلوس أو الاسم واستكشف الكليات الأقرب لمجموعك ومحافظتك بتوقعات دقيقة.",
    url: "https://masarak.live",
    siteName: "مسارك",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/images/masarak-hero-v2.webp",
        width: 1200,
        height: 630,
        alt: "مسارك - نتيجة الثانوية العامة وتوقع الكليات",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "مسارك | نتيجة الثانوية العامة وتوقع الكليات",
    description:
      "من نتيجتك لأقرب اختيار. ابحث عن نتيجة الثانوية العامة برقم الجلوس أو الاسم واستكشف الكليات الأقرب لمجموعك ومحافظتك بتوقعات دقيقة.",
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

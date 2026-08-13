import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = {
  title: "توقعات تنسيق 2026",
  description: "اعرف أقرب كلياتك بالاسم أو رقم الجلوس للمرحلة الثانية والثالثة.",
};

export default function PredictPage() {
  return (
    <ToolPage
      title="اعرف أقرب كلياتك"
      description="ابحث باسمك أو رقم جلوسك وشوف أول ترشيح مجانًا."
    />
  );
}

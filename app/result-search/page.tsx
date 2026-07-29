import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = {
  title: "البحث عن النتيجة",
  description:
    "ابحث عن نتيجة الثانوية العامة برقم الجلوس أو جزء من الاسم ثم انقل المجموع مباشرة إلى أداة توقع الكليات.",
  robots: { index: false, follow: false },
};

export default function ResultSearchPage() {
  return (
    <ToolPage
      title="اعرف نتيجتك"
      description="ابحث برقم الجلوس الكامل أو بجزء من الاسم. لا نضع بيانات البحث في عنوان الصفحة أو أدوات التحليل."
      initialTool="search"
    />
  );
}

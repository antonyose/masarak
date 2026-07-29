import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = {
  title: "توقع الكليات",
  description:
    "أدخل مجموعك أو نسبتك لاستكشاف الكليات الأقرب بناءً على ترتيبك النسبي وبيانات السنوات السابقة.",
};

export default function PredictPage() {
  return (
    <ToolPage
      title="اعرف الكليات المتوقعة"
      description="توقع استرشادي يستخدم ترتيبك النسبي داخل توزيع الدرجات، ويعرض خيارات طموحة ومناسبة وآمنة دون ادعاء ضمان القبول."
      initialTool="predict"
    />
  );
}

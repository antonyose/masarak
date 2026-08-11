import type { Metadata } from "next";
import { LoginExperience } from "@/components/login-experience";

export const metadata: Metadata = { title: "الدخول وإنشاء حساب", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <section className="page-hero"><div className="shell"><h1>حساب مسارك</h1><p>احفظ نتيجتك وتوقعاتك، وتابع حالة تفعيل التقرير من مكان واحد.</p></div><div className="shell py-8"><LoginExperience /></div></section>;
}

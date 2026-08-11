import type { Metadata } from "next";
import { LoginExperience } from "@/components/login-experience";

export const metadata: Metadata = { title: "الدخول وإنشاء حساب", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <section className="page-hero"><div className="shell"><h1>كمّل تقريرك</h1><p>سجّل دخولك علشان تحفظ نتيجتك وتشوف باقي الترشيحات.</p></div><div className="shell py-8"><LoginExperience /></div></section>;
}

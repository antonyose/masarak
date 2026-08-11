import type { Metadata } from "next";
import { AccountExperience } from "@/components/account-experience";

export const metadata: Metadata = { title: "حسابي", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <><section className="page-hero"><div className="shell"><h1>حسابي</h1><p>بيانات الحساب، النتائج المحفوظة، سجل التوقعات، وطلبات تفعيل التقرير.</p></div></section><section className="tool-stage"><div className="shell"><AccountExperience /></div></section></>;
}

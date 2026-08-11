import type { Metadata } from "next";
import { PremiumReport } from "@/components/premium-report";

export const metadata: Metadata = { title: "التقرير الكامل", robots: { index: false, follow: false } };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><section className="page-hero"><div className="shell"><h1>التقرير الكامل</h1><p>نسخة تاريخية محفوظة كما أُنشئت، ولا تتغير عند تفعيل نموذج أو مرحلة لاحقة.</p></div></section><section className="tool-stage"><div className="shell"><PremiumReport predictionId={id} /></div></section></>;
}

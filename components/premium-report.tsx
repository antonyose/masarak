"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Recommendation = { id: string; officialNameArabic: string; category: string; expectedRange: [number, number]; proximityLabel: string; explanation: string; historicalCutoffs: Record<string, number> };
type Report = { modelVersion: string; coordinationStage: number; percentage: number; confidence: string; recommendations: Recommendation[]; officialClosedFacts: Array<{ id: string; officialNameArabic: string; percentage: number }>; disclaimer: string };

export function PremiumReport({ predictionId }: { predictionId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/predictions/${predictionId}/report`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setReport(data.report); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "تعذر تحميل التقرير."));
  }, [predictionId]);
  if (error) return <div className="border border-amber-300 bg-amber-50 p-6"><strong>{error}</strong><p className="mt-2 text-sm">إذا لم يتم التفعيل بعد، أرسل إيصال الدفع من الحساب وانتظر المراجعة.</p><Link href={`/account?prediction=${predictionId}`} className="mt-4 inline-flex bg-[#173a55] px-5 py-3 font-bold text-white">العودة للحساب</Link></div>;
  if (!report) return <div className="bg-white p-8">جارٍ تحميل التقرير المصرح به…</div>;
  return <div className="grid gap-5"><div className="border-r-4 border-teal-700 bg-teal-50 p-5"><div className="flex flex-wrap justify-between gap-2"><strong>المرحلة {report.coordinationStage} · نموذج {report.modelVersion}</strong><span>{report.percentage}% · الثقة {report.confidence}</span></div></div><div className="grid gap-3 md:grid-cols-2">{report.recommendations.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-extrabold text-[#173a55]">{item.officialNameArabic}</h2><span className="bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">{item.category}</span></div><p className="mt-2 text-sm">النطاق {item.expectedRange[0]}%–{item.expectedRange[1]}% · {item.proximityLabel}</p><p className="mt-3 text-sm text-slate-600">{item.explanation}</p><p className="mt-2 text-xs text-slate-500">الحدود التاريخية: {Object.entries(item.historicalCutoffs).map(([year, value]) => `${year}: ${value}%`).join(" · ") || "غير كافية"}</p></article>)}</div>{report.officialClosedFacts.length ? <section className="border border-slate-200 bg-white p-5"><h2 className="text-xl font-extrabold text-[#173a55]">حقائق أُغلقت في المرحلة الأولى</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{report.officialClosedFacts.map((fact) => <p key={fact.id} className="bg-slate-50 p-3 text-sm"><strong>{fact.officialNameArabic}</strong> — {fact.percentage}%</p>)}</div></section> : null}<p className="text-xs leading-6 text-slate-500">{report.disclaimer}</p></div>;
}

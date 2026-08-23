"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { PredictionV2ReportView } from "@/components/prediction-v2-report-view";
import type { PredictionV2Report } from "@/lib/prediction-v2/types";
import { Stage3ReportView } from "@/components/stage3-report-view";
import type { Stage3Report } from "@/lib/prediction-stage3/types";

type Recommendation = {
  id: string;
  officialNameArabic: string;
  category: string;
  proximityLabel: string;
};
type Report = {
  schemaVersion?: string;
  coordinationStage: number;
  recommendations: Recommendation[];
  disclaimer: string;
};

function simpleProximity(label: string) {
  if (!label || label === "محافظة أخرى" || label === "other") return null;
  return label === "نطاق قريب استرشادي" ? "قريبة منك" : label;
}

const categoryLabels: Record<string, string> = {
  safe: "مناسب جدًا",
  target: "مناسب ليك",
  reach: "اختيار طموح",
  unlikely: "بعيد عن مجموعك",
  insufficient_data: "لسه بنحدّثه",
};

export function PremiumReport({ predictionId }: { predictionId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/predictions/${predictionId}/report`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setReport(data.report);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "تعذر تحميل التقرير."),
      );
  }, [predictionId]);

  if (error) {
    return (
      <div className="border border-amber-300 bg-amber-50 p-6">
        <strong>{error}</strong>
        <p className="mt-2 text-sm">أرسل إيصال الدفع من حسابك وانتظر المراجعة.</p>
        <Link
          href={`/account?prediction=${predictionId}`}
          className="mt-4 inline-flex bg-[#173a55] px-5 py-3 font-bold text-white"
        >
          العودة للحساب
        </Link>
      </div>
    );
  }

  if (!report) return <div className="bg-white p-8">بنجهّز تقريرك…</div>;

  if (report.schemaVersion === "prediction-v2-report@1") {
    return <PredictionV2ReportView report={report as unknown as PredictionV2Report} />;
  }
  if (report.schemaVersion === "stage3-report@1") {
    return <Stage3ReportView report={report as unknown as Stage3Report} />;
  }

  return (
    <div className="grid gap-5">
      <div className="bg-teal-50 p-5">
        <span className="text-sm font-bold text-teal-800">تقريرك الكامل</span>
        <h1 className="mt-1 text-2xl font-extrabold text-[#173a55]">
          كل الترشيحات المناسبة ليك
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          تقرير محفوظ من مرحلة سابقة في تنسيق 2026
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {report.recommendations.map((item, index) => (
          <article key={item.id} className="free-recommendation">
            <div className="recommendation-number">{index + 1}</div>
            <div className="recommendation-copy">
              <span>{categoryLabels[item.category] ?? "اختيار مقترح"}</span>
              <h2>{item.officialNameArabic}</h2>
              {simpleProximity(item.proximityLabel) ? <p>{simpleProximity(item.proximityLabel)}</p> : null}
            </div>
            <GraduationCap size={28} aria-hidden="true" />
          </article>
        ))}
      </div>
    </div>
  );
}

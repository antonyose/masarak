"use client";

import { AlertTriangle, FlaskConical, GraduationCap, MapPin } from "lucide-react";
import type {
  PredictionV2Recommendation,
  PredictionV2Report,
  Stage3ForecastV2,
} from "@/lib/prediction-v2/types";

const fitStyles = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  yellow: "border-amber-200 bg-amber-50 text-amber-950",
  orange: "border-orange-200 bg-orange-50 text-orange-950",
  red: "border-rose-200 bg-rose-50 text-rose-950",
} as const;

function RecommendationCard({ item }: { item: PredictionV2Recommendation }) {
  return (
    <article className={`rounded-2xl border p-4 ${fitStyles[item.fit]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-extrabold">{item.fitLabel}</span>
          <h3 className="mt-1 text-base font-extrabold text-[#173a55]">
            {item.officialNameArabic}
          </h3>
        </div>
        <GraduationCap size={24} aria-hidden="true" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>متوقع: <bdi>{item.predictedCutoffPercentage}%</bdi></span>
        <span>النطاق: <bdi>{item.expectedRange[0]}–{item.expectedRange[1]}%</bdi></span>
        <span className="inline-flex items-center gap-1"><MapPin size={13} />{item.proximityLabel}</span>
      </div>
      {item.requiresAptitudeTest ? (
        <p className="mt-2 text-xs font-bold">يتطلب تأكيد اجتياز اختبار القدرات.</p>
      ) : null}
      {item.limitedDataWarning ? (
        <p className="mt-2 text-xs">{item.limitedDataWarning}</p>
      ) : null}
    </article>
  );
}

function ForecastCard({ item }: { item: Stage3ForecastV2 }) {
  return (
    <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
      <span className="text-xs font-extrabold">{item.availabilityLabel}</span>
      <h3 className="mt-1 text-base font-extrabold text-[#173a55]">
        {item.officialNameArabic}
      </h3>
      <p className="mt-2 text-xs">
        تقدير تاريخي: <bdi>{item.expectedRange[0]}–{item.expectedRange[1]}%</bdi> — ليس إتاحة رسمية.
      </p>
    </article>
  );
}

export function PredictionV2ReportView({ report }: { report: PredictionV2Report }) {
  const closest = report.groups.closest;
  const ambitious = report.groups.ambitious;
  const stage3 = report.groups.stage3Forecast;
  const higher = report.groups.higherThanScore;

  return (
    <div className="grid gap-6" dir="rtl">
      <header className="rounded-2xl bg-teal-50 p-5">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold text-teal-800">
          <FlaskConical size={15} /> نموذج ظل — غير مفعّل للطلاب
        </span>
        <h1 className="mt-2 text-2xl font-extrabold text-[#173a55]">
          إيه أقرب كليات حكومية ممكن تدخلها فعلًا؟
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          الخيارات مرتبة حسب ملاءمة مجموعك أولًا، ثم الثقة والموقع الجغرافي.
        </p>
      </header>

      {report.coverageWarning.active ? (
        <aside className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="shrink-0" size={20} aria-hidden="true" />
          <div>
            <strong>تنبيه تغطية</strong>
            <p className="mt-1">{report.coverageWarning.message}</p>
          </div>
        </aside>
      ) : null}

      <section>
        <h2 className="text-xl font-extrabold text-[#173a55]">أقرب اختيارات لمجموعك</h2>
        <p className="mt-1 text-sm text-slate-600">مناسب جدًا وفرصة جيدة، من قائمة المرحلة الثانية الحالية فقط.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {closest.items.map((item) => <RecommendationCard key={item.id} item={item} />)}
        </div>
        {closest.hiddenCount ? <p className="mt-2 text-xs text-slate-500">+ {closest.hiddenCount} اختيار واقعي إضافي في البيانات.</p> : null}
      </section>

      {ambitious.items.length ? (
        <section>
          <h2 className="text-xl font-extrabold text-[#173a55]">اختيارات طموحة</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {ambitious.items.map((item) => <RecommendationCard key={item.id} item={item} />)}
          </div>
          {ambitious.hiddenCount ? <p className="mt-2 text-xs text-slate-500">+ {ambitious.hiddenCount} اختيار طموح إضافي.</p> : null}
        </section>
      ) : null}

      {stage3.items.length ? (
        <section>
          <h2 className="text-xl font-extrabold text-[#173a55]">متوقع تظهر في المرحلة الثالثة</h2>
          <p className="mt-1 text-sm font-bold text-sky-900">توقع منفصل، وليس إعلان إتاحة رسمية.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {stage3.items.map((item) => <ForecastCard key={item.id} item={item} />)}
          </div>
        </section>
      ) : null}

      {higher.items.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-extrabold text-[#173a55]">
            اختيارات أعلى من مجموعك ({higher.items.length + higher.hiddenCount})
          </summary>
          <p className="mt-2 text-sm text-slate-600">نعرض عددًا محدودًا فقط حتى لا يتحول التقرير إلى قائمة طويلة من البطاقات الحمراء.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {higher.items.map((item) => <RecommendationCard key={item.id} item={item} />)}
          </div>
          {higher.hiddenCount ? <p className="mt-2 text-xs text-slate-500">تم إخفاء {higher.hiddenCount} اختيارًا أبعد عن مجموعك.</p> : null}
        </details>
      ) : null}

      <p className="text-xs leading-6 text-slate-500">{report.disclaimer}</p>
    </div>
  );
}

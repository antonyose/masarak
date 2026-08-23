"use client";

import { CheckCircle2, GraduationCap, MapPin } from "lucide-react";
import type { Stage3Recommendation, Stage3Report } from "@/lib/prediction-stage3/types";

const fitStyles = {
  green: "border-emerald-200 bg-emerald-50",
  yellow: "border-amber-200 bg-amber-50",
  orange: "border-orange-200 bg-orange-50",
  red: "border-rose-200 bg-rose-50",
} as const;

function Card({ item }: { item: Stage3Recommendation }) {
  return (
    <article className={`rounded-2xl border p-4 ${fitStyles[item.fit]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-800"><CheckCircle2 size={14} />{item.availabilityLabel}</span>
          <h3 className="mt-1 text-base font-extrabold text-[#173a55]">{item.officialNameArabic}</h3>
          <strong className="mt-1 block text-sm">{item.fitLabel}</strong>
        </div>
        <GraduationCap size={24} aria-hidden="true" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
        <span>الحد المتوقع: <bdi>{item.expectedRange[0]}–{item.expectedRange[1]}%</bdi></span>
        <span className="inline-flex items-center gap-1"><MapPin size={13} />{item.proximityLabel}</span>
      </div>
      {item.eligibilityCondition ? <p className="mt-2 text-xs font-bold">{item.eligibilityCondition}</p> : null}
    </article>
  );
}

export function Stage3ReportView({ report }: { report: Stage3Report }) {
  const sections = [
    { key: "closest", title: "أقرب اختيارات المرحلة الثالثة لمجموعك", description: "مناسب جدًا وفرصة جيدة.", group: report.groups.closest },
    { key: "ambitious", title: "اختيارات طموحة", description: "متاحة رسميًا، لكن حدها المتوقع قريب أو أعلى قليلًا من مجموعك.", group: report.groups.ambitious },
    { key: "conditional", title: "اختيارات بشروط إضافية", description: "راجع شرط القدرات أو النوع قبل إضافتها للرغبات.", group: report.groups.conditional },
  ];
  return (
    <div className="grid gap-6" dir="rtl">
      <header className="rounded-2xl bg-teal-50 p-5">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold text-teal-800"><CheckCircle2 size={15} /> المرحلة الثالثة 2026</span>
        <h1 className="mt-2 text-2xl font-extrabold text-[#173a55]">اختيارات متاحة رسميًا ومرتبة حسب مجموعك</h1>
        <p className="mt-1 text-sm text-slate-600">الإتاحة حقيقة رسمية. الحد النهائي المتوقع هو الجزء التقديري.</p>
      </header>
      {sections.map(({ key, title, description, group }) => group.items.length ? (
        <section key={key}>
          <h2 className="text-xl font-extrabold text-[#173a55]">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{group.items.map((item) => <Card key={item.id} item={item} />)}</div>
          {group.hiddenCount ? <p className="mt-2 text-xs text-slate-500">+ {group.hiddenCount} اختيار إضافي.</p> : null}
        </section>
      ) : null)}
      {report.groups.higherThanScore.items.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-extrabold text-[#173a55]">اختيارات أعلى من مجموعك ({report.groups.higherThanScore.items.length + report.groups.higherThanScore.hiddenCount})</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{report.groups.higherThanScore.items.map((item) => <Card key={item.id} item={item} />)}</div>
        </details>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">{report.disclaimers.map((item) => <p key={item}>{item}</p>)}</div>
    </div>
  );
}

"use client";

import React from "react";
import { Compass, Sparkles, Target, Zap } from "lucide-react";
import type { ReportInsights } from "@/lib/report-sectors";

export function ReportInsightsSummary({
  insights,
  studentName,
  governorate,
  isStage3Report = false,
}: {
  insights: ReportInsights;
  studentName?: string;
  score?: number | null;
  governorate?: string | null;
  isStage3Report?: boolean;
}) {
  return (
    <section className="report-insights-summary" aria-label="ملخص الذكاء والفرص لنتيجتك">
      <div className="insights-header">
        <div className="insights-badge">
          <Sparkles size={15} aria-hidden="true" />
          <span>ملخص الذكاء الاستراتيجي لنتيجتك</span>
        </div>
        <h4>
          {studentName
            ? `${isStage3Report ? "أبرز توقعات" : "الخلاصة الاستراتيجية لـ"} ${studentName}`
            : isStage3Report ? "أبرز توقعات المرحلة الثالثة" : "الخلاصة الاستراتيجية لمجموعك"}
        </h4>
        <p className="insights-advice">{insights.strategicAdvice}</p>
      </div>

      <div className="insights-cards-grid">
        {insights.topLocalOptions.length > 0 && (
          <div className="insight-card insight-card-local">
            <div className="insight-card-icon" aria-hidden="true">
              <Target size={18} />
            </div>
            <div className="insight-card-content">
              <span className="insight-card-kicker">
                {isStage3Report
                  ? governorate ? `أقرب توقعاتك في نطاق ${governorate}` : "أقرب توقعاتك في نطاقك الجغرافي"
                  : governorate ? `أقوى فرصك في نطاق ${governorate}` : "أقوى فرصك في نطاقك الجغرافي"}
              </span>
              <strong>{insights.topLocalOptions[0].officialNameArabic}</strong>
              {insights.topLocalOptions.length > 1 && (
                <small>بالإضافة إلى: {insights.topLocalOptions.slice(1).map((i) => i.officialNameArabic).join(" · ")}</small>
              )}
            </div>
          </div>
        )}

        {insights.topAmbitiousOptions.length > 0 && (
          <div className="insight-card insight-card-ambitious">
            <div className="insight-card-icon" aria-hidden="true">
              <Zap size={18} />
            </div>
            <div className="insight-card-content">
              <span className="insight-card-kicker">
                {isStage3Report ? "أفضل توقع طموح يستحق المتابعة" : "أفضل اختيار طموح يستحق التجربة"}
              </span>
              <strong>{insights.topAmbitiousOptions[0].officialNameArabic}</strong>
              <small>فرصة منافسة جيدة ضمن الرغبات الأولى</small>
            </div>
          </div>
        )}

        {insights.dominantSectors.length > 0 && (
          <div className="insight-card insight-card-sectors">
            <div className="insight-card-icon" aria-hidden="true">
              <Compass size={18} />
            </div>
            <div className="insight-card-content">
              <span className="insight-card-kicker">أبرز القطاعات المتوافقة مع مجموعك</span>
              <div className="insight-sector-tags">
                {insights.dominantSectors.map((sector) => (
                  <span key={sector.id} className="insight-sector-pill">
                    {sector.icon} {sector.shortLabel}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

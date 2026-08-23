"use client";

import React from "react";
import { CheckCircle2, ListOrdered, Printer } from "lucide-react";
import type { TansikBlueprintStage } from "@/lib/report-sectors";

export function TansikBlueprintGuide({
  stages,
  onPrint,
}: {
  stages: TansikBlueprintStage[];
  onPrint?: () => void;
}) {
  return (
    <section className="tansik-blueprint-section" aria-label="دليل استراتيجية ترتيب الـ 75 رغبة">
      <div className="blueprint-header">
        <div>
          <div className="blueprint-tag">
            <ListOrdered size={15} aria-hidden="true" />
            <span>خطة التقديم الذكية</span>
          </div>
          <h4>دليل توزيع الـ 75 رغبة في موقع التنسيق</h4>
          <p>
            توزيع استراتيجي مقترح لكليات تقريرك على موقع التنسيق الرسمي لتحسين ترتيب اختياراتك وتفادي استنفاد الرغبات.
          </p>
        </div>

        {onPrint && (
          <button type="button" className="blueprint-print-button" onClick={onPrint}>
            <Printer size={16} aria-hidden="true" />
            <span>طباعة التقرير / حفظ PDF</span>
          </button>
        )}
      </div>

      <div className="blueprint-stages-grid">
        {stages.map((stage, index) => (
          <div key={index} className={`blueprint-stage-card ${stage.badgeClass}`}>
            <div className="blueprint-stage-top">
              <span className="blueprint-range-badge">{stage.rangeText}</span>
              <span className="blueprint-stage-number">المرحلة {index + 1}</span>
            </div>
            <h5>{stage.bracketTitle}</h5>
            <p>{stage.description}</p>
            <div className="blueprint-samples">
              <span className="blueprint-samples-label">أمثلة من تقريرك:</span>
              <ul>
                {stage.sampleColleges.map((college, cIndex) => (
                  <li key={cIndex}>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>{college}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

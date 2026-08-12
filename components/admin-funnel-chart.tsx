"use client";

type Props = {
  data: Array<{ event_name: string; label: string; total: number; instrumented: boolean }>;
  mode: "sessions" | "aggregate";
};

const colors = ["#0d9488", "#0891b2", "#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#e11d48", "#dc2626"];

export function AdminFunnelChart({ data, mode }: Props) {
  const maxVal = Math.max(...data.map((step) => step.total), 1);

  return (
    <div className="admin-funnel">
      <h4 className="admin-section-title">مسار التحويل (آخر 30 يوم)</h4>
      <p className="admin-funnel-help">
        {mode === "sessions" ? "كل رقم يمثل جلسات مجهولة فريدة وصلت للخطوة." : "الأرقام القديمة تفاعلات مجمعة؛ تبدأ دقة الجلسات مع التتبع الجديد."}
      </p>
      <div className="admin-funnel-steps">
        {data.map((step, i) => {
          const pct = maxVal > 0 ? (step.total / maxVal) * 100 : 0;
          const previous = i > 0 ? data[i - 1] : null;
          const dropPct = previous?.instrumented && step.instrumented && previous.total > 0 && step.total <= previous.total
            ? Math.round(((previous.total - step.total) / previous.total) * 100)
            : 0;

          return (
            <div key={step.event_name} className={`admin-funnel-step${step.instrumented ? "" : " is-awaiting"}`}>
              <div className="admin-funnel-label">
                <span>{step.label}</span>
                <span className="admin-funnel-count">
                  {step.instrumented ? step.total.toLocaleString("ar-EG") : "يبدأ الآن"}
                  {i > 0 && dropPct > 0 ? (
                    <span className="admin-funnel-drop">−{dropPct}%</span>
                  ) : null}
                </span>
              </div>
              <div className="admin-funnel-bar-bg">
                <div
                  className="admin-funnel-bar"
                  style={{ width: `${step.total > 0 ? Math.max(pct, 2) : 0}%`, background: colors[i % colors.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

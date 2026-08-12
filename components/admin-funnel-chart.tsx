"use client";

type FunnelStep = { label: string; key: string; color: string };

const FUNNEL_STEPS: FunnelStep[] = [
  { label: "مشاهدات الصفحة", key: "page_view", color: "#0d9488" },
  { label: "بحث عن نتيجة", key: "search_result", color: "#0891b2" },
  { label: "عرض العرض", key: "offer_viewed", color: "#2563eb" },
  { label: "ضغط على العرض", key: "offer_clicked", color: "#7c3aed" },
  { label: "ضغط على التسعير", key: "pricing_cta_clicked", color: "#9333ea" },
  { label: "اختيار المنتج", key: "product_selected", color: "#c026d3" },
  { label: "رفع إيصال", key: "receipt_uploaded", color: "#e11d48" },
  { label: "إرسال دفع", key: "payment_submitted", color: "#dc2626" },
];

type Props = {
  data: Array<{ event_name: string; total: number }>;
};

export function AdminFunnelChart({ data }: Props) {
  const lookup = Object.fromEntries(data.map((d) => [d.event_name, d.total]));
  const maxVal = Math.max(...FUNNEL_STEPS.map((s) => lookup[s.key] ?? 0), 1);

  return (
    <div className="admin-funnel">
      <h4 className="admin-section-title">مسار التحويل (آخر 30 يوم)</h4>
      <div className="admin-funnel-steps">
        {FUNNEL_STEPS.map((step, i) => {
          const count = lookup[step.key] ?? 0;
          const pct = maxVal > 0 ? (count / maxVal) * 100 : 0;
          const prevCount = i > 0 ? (lookup[FUNNEL_STEPS[i - 1].key] ?? 0) : count;
          const dropPct = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;

          return (
            <div key={step.key} className="admin-funnel-step">
              <div className="admin-funnel-label">
                <span>{step.label}</span>
                <span className="admin-funnel-count">
                  {count.toLocaleString("ar-EG")}
                  {i > 0 && dropPct > 0 ? (
                    <span className="admin-funnel-drop">−{dropPct}%</span>
                  ) : null}
                </span>
              </div>
              <div className="admin-funnel-bar-bg">
                <div
                  className="admin-funnel-bar"
                  style={{ width: `${Math.max(pct, 2)}%`, background: step.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

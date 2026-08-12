"use client";

import { Activity, Clock3, Info, MousePointerClick, TriangleAlert, Users } from "lucide-react";

export type AdminBehaviorData = {
  periodDays: number;
  mode: "sessions" | "aggregate";
  instrumentedAt: string | null;
  uniqueSessions: number;
  minimumSessionSample: number;
  engagedSessions: number;
  totalInteractions: number;
  rates: Array<{
    key: "resultReach" | "offerReach" | "checkoutCompletion" | "approval";
    label: string;
    value: number | null;
    numerator: number;
    denominator: number;
  }>;
  insights: Array<{
    tone: "positive" | "warning" | "info";
    title: string;
    detail: string;
  }>;
  busyHours: Array<{ hour: number; total: number }>;
  devices: Array<{ device: string; total: number }>;
  topPaths: Array<{ path: string; total: number }>;
};

const deviceLabels: Record<string, string> = {
  mobile: "موبايل",
  tablet: "تابلت",
  desktop: "كمبيوتر",
  unknown: "غير معروف",
};

function formatHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "م" : "ص";
  const display = normalized % 12 || 12;
  return `${display}:00 ${suffix}`;
}

export function AdminBehaviorOverview({ data }: { data: AdminBehaviorData }) {
  const resultRate = data.rates.find((rate) => rate.key === "resultReach");
  const checkoutRate = data.rates.find((rate) => rate.key === "checkoutCompletion");
  const approvalRate = data.rates.find((rate) => rate.key === "approval");
  const engagementRate = data.uniqueSessions > 0
    ? Math.round((data.engagedSessions / data.uniqueSessions) * 1000) / 10
    : null;

  const summary = data.mode === "sessions"
    ? [
        { label: "جلسات فريدة", value: data.uniqueSessions.toLocaleString("ar-EG"), icon: <Users size={18} /> },
        { label: "جلسات متفاعلة", value: engagementRate === null ? "—" : `${engagementRate}%`, icon: <Activity size={18} /> },
        { label: "وصلوا لنتيجة", value: resultRate?.value == null ? "—" : `${resultRate.value}%`, icon: <MousePointerClick size={18} /> },
        { label: "أكملوا الدفع", value: checkoutRate?.value == null ? "—" : `${checkoutRate.value}%`, icon: <Clock3 size={18} /> },
      ]
    : [
        { label: "تفاعلات مسجلة", value: data.totalInteractions.toLocaleString("ar-EG"), icon: <Activity size={18} /> },
        { label: "الوصول لنتيجة", value: resultRate?.value == null ? "—" : `${resultRate.value}%`, icon: <MousePointerClick size={18} /> },
        { label: "إكمال الدفع", value: checkoutRate?.value == null ? "—" : `${checkoutRate.value}%`, icon: <Clock3 size={18} /> },
        { label: "طلبات مقبولة", value: approvalRate?.value == null ? "—" : `${approvalRate.value}%`, icon: <Users size={18} /> },
      ];

  return (
    <section className="admin-panel admin-behavior-panel">
      <div className="admin-panel-header">
        <div>
          <h3 className="admin-panel-title">ماذا يفعل الزوار؟</h3>
          <p className="admin-panel-sub">قراءة عملية لآخر {data.periodDays.toLocaleString("ar-EG")} يوم، من الزيارة حتى الدفع.</p>
        </div>
        <span className={`admin-data-mode ${data.mode === "sessions" ? "is-live" : "is-legacy"}`}>
          {data.mode === "sessions"
            ? "جلسات مجهولة فريدة"
            : data.uniqueSessions > 0
              ? `بناء عينة الجلسات ${data.uniqueSessions}/${data.minimumSessionSample}`
              : "تفاعلات مجمعة قديمة"}
        </span>
      </div>

      <div className="admin-behavior-summary">
        {summary.map((item) => (
          <div className="admin-behavior-stat" key={item.label}>
            <span className="admin-behavior-stat-icon">{item.icon}</span>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-behavior-content">
        <div className="admin-insight-list">
          <h4>أهم ما يستحق انتباهك</h4>
          {data.insights.length ? data.insights.map((insight) => (
            <div className={`admin-insight admin-insight-${insight.tone}`} key={insight.title}>
              <span className="admin-insight-icon">
                {insight.tone === "warning" ? <TriangleAlert size={17} /> : <Info size={17} />}
              </span>
              <div>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
              </div>
            </div>
          )) : <p className="admin-empty-text">نحتاج مزيدًا من الزيارات قبل استخراج استنتاج موثوق.</p>}
        </div>

        <div className="admin-behavior-details">
          <div>
            <h4>أوقات النشاط الأعلى</h4>
            {data.busyHours.length ? (
              <div className="admin-hour-list">
                {data.busyHours.map((item) => (
                  <span key={item.hour}><bdi>{formatHour(item.hour)}</bdi><strong>{item.total.toLocaleString("ar-EG")}</strong></span>
                ))}
              </div>
            ) : <span className="admin-muted-value">لا توجد بيانات كافية بعد</span>}
          </div>

          {data.mode === "sessions" && data.devices.length ? (
            <div>
              <h4>الأجهزة</h4>
              <div className="admin-device-list">
                {data.devices.map((item) => (
                  <span key={item.device}>{deviceLabels[item.device] ?? item.device}<strong>{item.total.toLocaleString("ar-EG")}</strong></span>
                ))}
              </div>
            </div>
          ) : null}

          {data.mode === "sessions" && data.topPaths.length ? (
            <div>
              <h4>أكثر الصفحات دخولًا</h4>
              <div className="admin-path-list">
                {data.topPaths.map((item) => (
                  <span key={item.path}><bdi>{item.path}</bdi><strong>{item.total.toLocaleString("ar-EG")}</strong></span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <p className="admin-privacy-note">التحليلات لا تحفظ اسم الطالب أو رقم الجلوس أو عنوان IP. النسب تصف سلوك الجلسات، وليست احتمالات شراء.</p>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3, Eye, History, RefreshCw, Search, Settings2,
  TrendingUp, Users, Wallet, Ticket,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import { AdminDailyChart } from "@/components/admin-daily-chart";
import { AdminFunnelChart } from "@/components/admin-funnel-chart";
import { AdminBehaviorOverview, type AdminBehaviorData } from "@/components/admin-behavior-overview";
import { AdminRevenueCards } from "@/components/admin-revenue-cards";
import { AdminAuditTable } from "@/components/admin-audit-table";
import { AdminPaymentsTable, type AdminPayment } from "@/components/admin-payments-table";
import { AdminQuickEntitlement } from "@/components/admin-quick-entitlement";
import { AdminDiscountCodes } from "@/components/admin-discount-codes";

type Coordination = {
  counts: { sources: number; officialCutoffs2026: number; stageVacancies2026: number };
  models: Array<{ id: string; version: string; year: number; stage: number; activatedAt: string | null }>;
};
type Stats = {
  totalViews: number; todayViews: number; predictCount: number;
  searchCount: number; lastVisit: string;
  timeSeries: Array<{ date: string; event_type: string; total: number }>;
  funnel: Array<{ event_name: string; total: number }>;
  behavior: AdminBehaviorData & {
    funnel: Array<{ event_name: string; label: string; total: number; instrumented: boolean }>;
    trafficTrend: Array<{ event_type: string; current_total: number; previous_total: number }>;
  };
  revenue: {
    totalRevenue: number; todayRevenue: number; weekRevenue: number; monthRevenue: number;
    totalApproved: number; totalPending: number; totalRejected: number;
    byProduct: Array<{ product_type: string; count: number; revenue: number }>;
    byMethod: Array<{ method: string; count: number; revenue: number }>;
  };
  users: { totalUsers: number; todayUsers: number; totalEntitlements: number };
};
type V2Diagnostics = {
  modelVersion: string;
  shadow: true;
  activated: false;
  activation: { active: boolean; activeModelVersion: string | null; activatedAt: string | null };
  data: {
    publicSourceRows: number;
    publicTechnologicalRows: number;
    publicInstituteRows: number;
    resolvedPublicVacancies: number;
    unresolvedPublicVacancies: number;
    ambiguousAliases: number;
    historicalRawRows: number;
    activationBlockers: string[];
  };
  evaluation: {
    holdout2024: { mae: number | null; p90: number | null; intervalCoverage: number | null };
    holdout2025: { mae: number | null; p90: number | null; intervalCoverage: number | null };
    validation2026: { mae: number | null; p90: number | null; intervalCoverage: number | null };
    scoreBands: { allRedReportRate: number | null; zeroRealisticOptionRate: number | null };
    gates: { dataQualityReady: boolean; modelQualityReady: boolean; productQualityReady: boolean; activationReady: boolean; blockers: string[] };
  };
  regressionCase: { diagnostics: { realisticOptions: number; fitCounts: { green: number; yellow: number; orange: number; red: number } }; groups: { higherThanScore: { items: unknown[]; hiddenCount: number } } };
};

type Tab = "overview" | "payments" | "audit" | "settings";

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const [tab, setTab] = useState<Tab>("overview");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [coordination, setCoordination] = useState<Coordination | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [v2, setV2] = useState<V2Diagnostics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPayments(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/payments?status=all&limit=500", { cache: "no-store" });
      if (!response.ok) {
        if (showLoading) setError(response.status === 403 ? "هذا الحساب لا يملك صلاحية الأدمن." : "تعذر تحميل طلبات الدفع.");
        return;
      }
      setPayments((await response.json()).payments);
    } catch {
      if (showLoading) setError("تعذر الاتصال بالخادم.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [queue, data, statsRes, v2Res] = await Promise.all([
        fetch("/api/admin/payments?status=all&limit=500"),
        fetch("/api/admin/coordination"),
        fetch("/api/admin/stats?days=14"),
        fetch("/api/admin/coordination/v2-shadow"),
      ]);
      if (!queue.ok || !data.ok) {
        setError(queue.status === 403 || data.status === 403 ? "هذا الحساب لا يملك صلاحية الأدمن." : "تعذر تحميل لوحة الإدارة.");
      } else {
        setPayments((await queue.json()).payments);
        setCoordination(await data.json());
        if (statsRes.ok) setStats(await statsRes.json());
        if (v2Res.ok) setV2(await v2Res.json());
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (session?.user) void load();
  }, [session?.user]);

  // Keep the active view fresh without repeatedly loading every dashboard endpoint.
  useEffect(() => {
    if (tab !== "overview" || !session?.user) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [tab, session?.user]);

  useEffect(() => {
    if (tab !== "payments" || !session?.user) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadPayments();
    };
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tab, session?.user]);

  async function review(id: string, action: "approve" | "reject", allowMissingReceipt = false) {
    const reason = action === "reject" ? window.prompt("سبب الرفض الظاهر للمستخدم:") : undefined;
    if (action === "reject" && (!reason || reason.trim().length < 3)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/payments/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, allowMissingReceipt } : { action, reason }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "تعذر تنفيذ الإجراء.");
      else await loadPayments();
    } catch {
      setError("تعذر الاتصال بالخادم. لم يتغير وضع الطلب.");
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = payments.filter((payment) => payment.status === "pending").length;
  const chartData = stats ? buildChartData(stats.timeSeries) : [];

  if (isPending) return <div className="admin-container"><div className="admin-card">جارٍ التحقق…</div></div>;
  if (!session?.user) return (
    <div className="admin-container">
      <div className="admin-card" style={{ textAlign: "center" }}>
        <p>استخدم حساب Better Auth المرقّى للوصول.</p>
        <Link href="/login" className="mt-4 inline-flex bg-teal-700 px-5 py-3 font-bold text-white">تسجيل الدخول</Link>
      </div>
    </div>
  );

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header-row">
        <div>
          <h2>لوحة تحكم مسارك 2026</h2>
          <p className="admin-subtitle">تحليلات · مدفوعات · إعدادات</p>
        </div>
        <button onClick={load} disabled={loading} className="admin-refresh-btn">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {/* Tab Navigation */}
      <nav className="admin-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "overview"} className={`admin-tab${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>
          <BarChart3 size={16} /> نظرة عامة
        </button>
        <button role="tab" aria-selected={tab === "payments"} className={`admin-tab${tab === "payments" ? " active" : ""}`} onClick={() => setTab("payments")}>
          <Wallet size={16} /> المدفوعات
          {pendingCount > 0 ? <span className="admin-tab-badge">{pendingCount}</span> : null}
        </button>
        <button role="tab" aria-selected={tab === "audit"} className={`admin-tab${tab === "audit" ? " active" : ""}`} onClick={() => setTab("audit")}>
          <History size={16} /> سجل التدقيق
        </button>
        <button role="tab" aria-selected={tab === "settings"} className={`admin-tab${tab === "settings" ? " active" : ""}`} onClick={() => setTab("settings")}>
          <Settings2 size={16} /> الإعدادات
        </button>
      </nav>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="admin-tab-panel">
          {/* KPI Cards */}
          <div className="admin-kpi-grid">
            <KpiCard icon={<Eye size={20} />} label="المشاهدات" value={stats?.totalViews ?? 0} sub={`اليوم: ${stats?.todayViews ?? 0}`} color="#0d9488" />
            <KpiCard icon={<Search size={20} />} label="عمليات البحث" value={stats?.searchCount ?? 0} color="#0891b2" />
            <KpiCard icon={<TrendingUp size={20} />} label="طلبات التقرير" value={stats?.predictCount ?? 0} color="#6366f1" />
            <KpiCard icon={<Wallet size={20} />} label="الإيرادات" value={stats?.revenue.totalRevenue ?? 0} isCurrency color="#059669" />
            <KpiCard icon={<Users size={20} />} label="حسابات مسجلة" value={stats?.users.totalUsers ?? 0} sub={`جديد اليوم: ${stats?.users.todayUsers ?? 0}`} color="#7c3aed" />
            <KpiCard icon={<Ticket size={20} />} label="الحقوق النشطة" value={stats?.users.totalEntitlements ?? 0} color="#e11d48" />
          </div>

          {stats?.behavior ? <AdminBehaviorOverview data={stats.behavior} /> : null}

          {/* Daily Traffic Chart */}
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h4 className="admin-section-title admin-section-title-compact">حركة الموقع (آخر 14 يوم)</h4>
                <p className="admin-panel-sub">المشاهدات وعمليات البحث والتقارير لكل يوم بتوقيت القاهرة.</p>
              </div>
              {stats?.behavior ? <TrafficTrend data={stats.behavior.trafficTrend} /> : null}
            </div>
            <AdminDailyChart data={chartData} />
          </section>

          {/* Funnel + Revenue side by side on desktop */}
          <div className="admin-insights-grid">
            <section className="admin-panel">
              {stats ? <AdminFunnelChart data={stats.behavior.funnel} mode={stats.behavior.mode} /> : <p className="admin-empty-text">جارٍ التحميل…</p>}
            </section>
            <section className="admin-panel">
              {stats ? <AdminRevenueCards data={stats.revenue} /> : <p className="admin-empty-text">جارٍ التحميل…</p>}
            </section>
          </div>

          {/* Coordination Summary */}
          {coordination ? (
            <div className="admin-coord-grid">
              <CoordCard label="المصادر" value={coordination.counts.sources} />
              <CoordCard label="حقائق المرحلة الأولى" value={coordination.counts.officialCutoffs2026} />
              <CoordCard label="شواغر المرحلة الثانية المحفوظة" value={coordination.counts.stageVacancies2026} />
              <CoordCard label="النماذج النشطة" value={coordination.models.filter((m) => m.activatedAt).length} />
            </div>
          ) : null}

          {v2 ? (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-section-kicker">Prediction V2 · {v2.activation.active ? "Production" : "Shadow"}</div>
                  <h3 className="admin-panel-title">{v2.modelVersion}</h3>
                  <p className="admin-panel-sub">
                    {v2.activation.active
                      ? "النموذج النشط حاليًا لتقارير الطلاب، مع بقاء V1 واللقطات والاستحقاقات محفوظة."
                      : "نموذج ظل غير مفعّل ولا يغيّر تقارير V1 أو الدفع والاستحقاقات."}
                  </p>
                </div>
                <span className={`admin-status-badge ${v2.activation.active || v2.evaluation.gates.activationReady ? "admin-status-approved" : "admin-status-pending"}`}>
                  {v2.activation.active ? "مفعّل في الإنتاج" : v2.evaluation.gates.activationReady ? "جاهز للتفعيل" : "محجوب عن التفعيل"}
                </span>
              </div>
              <div className="admin-coord-grid">
                <CoordCard label="صفوف عامة/تكنولوجية" value={v2.data.publicSourceRows} />
                <CoordCard label="شواغر محلولة حسب الشعبة" value={v2.data.resolvedPublicVacancies} />
                <CoordCard label="Aliases غير محلولة" value={v2.data.unresolvedPublicVacancies + v2.data.ambiguousAliases} />
                <CoordCard label="سجلات تاريخية خام" value={v2.data.historicalRawRows} />
                <CoordCard label="خيارات واقعية لحالة 223.5" value={v2.regressionCase.diagnostics.realisticOptions} />
                <CoordCard label="بطاقات حمراء ظاهرة" value={v2.regressionCase.groups.higherThanScore.items.length} />
              </div>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
                <div><strong>2024 MAE:</strong> {v2.evaluation.holdout2024.mae ?? "—"}</div>
                <div><strong>2025 MAE:</strong> {v2.evaluation.holdout2025.mae ?? "—"}</div>
                <div><strong>2026 MAE:</strong> {v2.evaluation.validation2026.mae ?? "—"}</div>
              </div>
              {v2.evaluation.gates.blockers.length ? (
                <ul className="mt-4 list-inside list-disc text-sm text-amber-900">
                  {v2.evaluation.gates.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      {/* Payments Tab */}
      {tab === "payments" && (
        <div className="admin-tab-panel">
          <AdminQuickEntitlement onCreated={load} />
          <AdminPaymentsTable payments={payments} loading={loading} onRefresh={() => void loadPayments(true)} onReview={(id, action, allowMissingReceipt) => void review(id, action, allowMissingReceipt)} />
        </div>
      )}

      {tab === "audit" ? <div className="admin-tab-panel"><AdminAuditTable /></div> : null}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="admin-tab-panel">
          <AdminDiscountCodes />
          <section className="admin-panel">
            <h3 className="admin-panel-title">إعدادات الدفع والعروض</h3>
            <p className="admin-panel-sub">تُقرأ هذه القيم من Neon عند إنشاء الطلب والعرض العام.</p>
            <AdminSettingsForm />
          </section>
        </div>
      )}
    </div>
  );
}

/* ─── Helper Components ─── */

function KpiCard({ icon, label, value, sub, isCurrency, color }: {
  icon: React.ReactNode; label: string; value: number;
  sub?: string; isCurrency?: boolean; color: string;
}) {
  const formatted = isCurrency
    ? `${value.toLocaleString("ar-EG", { minimumFractionDigits: 0 })} جنيه`
    : value.toLocaleString("ar-EG");
  return (
    <div className="admin-kpi-card" style={{ borderTopColor: color }}>
      <div className="admin-kpi-icon" style={{ color }}>{icon}</div>
      <div className="admin-kpi-body">
        <span className="admin-kpi-label">{label}</span>
        <strong className="admin-kpi-value">{formatted}</strong>
        {sub ? <span className="admin-kpi-sub">{sub}</span> : null}
      </div>
    </div>
  );
}

function CoordCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-coord-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrafficTrend({ data }: { data: Array<{ event_type: string; current_total: number; previous_total: number }> }) {
  const views = data.find((row) => row.event_type === "view");
  if (!views || views.previous_total <= 0) return <span className="admin-trend-note">أول فترة قياس</span>;
  const change = Math.round(((views.current_total - views.previous_total) / views.previous_total) * 100);
  return (
    <span className={`admin-trend-note ${change >= 0 ? "is-up" : "is-down"}`}>
      {change >= 0 ? "+" : ""}{change}% عن الـ7 أيام السابقة
    </span>
  );
}

function buildChartData(timeSeries: Array<{ date: string; event_type: string; total: number }>) {
  const byDate = new Map<string, { views: number; searches: number; predictions: number }>();
  for (const row of timeSeries) {
    const entry = byDate.get(row.date) ?? { views: 0, searches: 0, predictions: 0 };
    if (row.event_type === "view") entry.views += row.total;
    else if (row.event_type === "search") entry.searches += row.total;
    else if (row.event_type === "predict") entry.predictions += row.total;
    byDate.set(row.date, entry);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));
}

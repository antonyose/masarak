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
import { AdminRevenueCards } from "@/components/admin-revenue-cards";
import { AdminAuditTable } from "@/components/admin-audit-table";
import { AdminPaymentsTable, type AdminPayment } from "@/components/admin-payments-table";

type Coordination = {
  counts: { sources: number; officialCutoffs2026: number; stageVacancies2026: number };
  models: Array<{ id: string; version: string; year: number; stage: number; activatedAt: string | null }>;
};
type Stats = {
  totalViews: number; todayViews: number; predictCount: number;
  searchCount: number; lastVisit: string;
  timeSeries: Array<{ date: string; event_type: string; total: number }>;
  funnel: Array<{ event_name: string; total: number }>;
  revenue: {
    totalRevenue: number; todayRevenue: number; weekRevenue: number; monthRevenue: number;
    totalApproved: number; totalPending: number; totalRejected: number;
    byProduct: Array<{ product_type: string; count: number; revenue: number }>;
    byMethod: Array<{ method: string; count: number; revenue: number }>;
  };
  users: { totalUsers: number; todayUsers: number; totalEntitlements: number };
};

type Tab = "overview" | "payments" | "audit" | "settings";

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const [tab, setTab] = useState<Tab>("overview");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [coordination, setCoordination] = useState<Coordination | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [queue, data, statsRes] = await Promise.all([
        fetch("/api/admin/payments?status=all&limit=500"),
        fetch("/api/admin/coordination"),
        fetch("/api/admin/stats?days=14"),
      ]);
      if (!queue.ok || !data.ok) {
        setError(queue.status === 403 || data.status === 403 ? "هذا الحساب لا يملك صلاحية الأدمن." : "تعذر تحميل لوحة الإدارة.");
      } else {
        setPayments((await queue.json()).payments);
        setCoordination(await data.json());
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (session?.user) void load();
  }, [session?.user]);

  // Auto-refresh overview every 60s
  useEffect(() => {
    if (tab !== "overview" || !session?.user) return;
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [tab, session?.user]);

  async function review(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("سبب الرفض الظاهر للمستخدم:") : undefined;
    if (action === "reject" && (!reason || reason.trim().length < 3)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/payments/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action } : { action, reason }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "تعذر تنفيذ الإجراء.");
      else await load();
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
            <KpiCard icon={<TrendingUp size={20} />} label="التوقعات" value={stats?.predictCount ?? 0} color="#6366f1" />
            <KpiCard icon={<Wallet size={20} />} label="الإيرادات" value={stats?.revenue.totalRevenue ?? 0} isCurrency color="#059669" />
            <KpiCard icon={<Users size={20} />} label="المستخدمين" value={stats?.users.totalUsers ?? 0} sub={`اليوم: ${stats?.users.todayUsers ?? 0}`} color="#7c3aed" />
            <KpiCard icon={<Ticket size={20} />} label="الحقوق النشطة" value={stats?.users.totalEntitlements ?? 0} color="#e11d48" />
          </div>

          {/* Daily Traffic Chart */}
          <section className="admin-panel">
            <h4 className="admin-section-title">حركة الموقع (آخر 14 يوم)</h4>
            <AdminDailyChart data={chartData} />
          </section>

          {/* Funnel + Revenue side by side on desktop */}
          <div className="admin-insights-grid">
            <section className="admin-panel">
              {stats ? <AdminFunnelChart data={stats.funnel} /> : <p className="admin-empty-text">جارٍ التحميل…</p>}
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
              <CoordCard label="شواغر المرحلة الثانية" value={coordination.counts.stageVacancies2026} />
              <CoordCard label="النماذج النشطة" value={coordination.models.filter((m) => m.activatedAt).length} />
            </div>
          ) : null}
        </div>
      )}

      {/* Payments Tab */}
      {tab === "payments" && (
        <div className="admin-tab-panel">
          <AdminPaymentsTable payments={payments} loading={loading} onRefresh={() => void load()} onReview={(id, action) => void review(id, action)} />
        </div>
      )}

      {tab === "audit" ? <div className="admin-tab-panel"><AdminAuditTable /></div> : null}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="admin-tab-panel">
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

"use client";

type RevenueData = {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  byProduct: Array<{ product_type: string; count: number; revenue: number }>;
  byMethod: Array<{ method: string; count: number; revenue: number }>;
};

const METHOD_LABELS: Record<string, string> = {
  vodafone_cash: "فودافون كاش",
  orange_cash: "أورانج كاش",
  instapay: "إنستاباي",
};

const PRODUCT_LABELS: Record<string, string> = {
  single: "تقرير فردي",
  friends_3: "عرض الصحاب (3)",
};

function fmtEgp(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function AdminRevenueCards({ data }: { data: RevenueData }) {
  const approvalRate = data.totalApproved + data.totalRejected > 0
    ? Math.round((data.totalApproved / (data.totalApproved + data.totalRejected)) * 100)
    : 0;

  return (
    <div className="admin-revenue">
      <h4 className="admin-section-title">الإيرادات والمدفوعات</h4>
      <div className="admin-revenue-grid">
        <div className="admin-revenue-card admin-revenue-total">
          <span className="admin-revenue-label">إجمالي الإيرادات</span>
          <strong className="admin-revenue-value">{fmtEgp(data.totalRevenue)} <small>جنيه</small></strong>
        </div>
        <div className="admin-revenue-card">
          <span className="admin-revenue-label">اليوم</span>
          <strong className="admin-revenue-value">{fmtEgp(data.todayRevenue)}</strong>
        </div>
        <div className="admin-revenue-card">
          <span className="admin-revenue-label">آخر 7 أيام</span>
          <strong className="admin-revenue-value">{fmtEgp(data.weekRevenue)}</strong>
        </div>
        <div className="admin-revenue-card">
          <span className="admin-revenue-label">آخر 30 يوم</span>
          <strong className="admin-revenue-value">{fmtEgp(data.monthRevenue)}</strong>
        </div>
      </div>

      <div className="admin-revenue-breakdown">
        <div className="admin-breakdown-section">
          <h5>حسب المنتج</h5>
          {data.byProduct.length ? data.byProduct.map((p) => (
            <div key={p.product_type} className="admin-breakdown-row">
              <span>{PRODUCT_LABELS[p.product_type] ?? p.product_type}</span>
              <span>{p.count} طلب · {fmtEgp(Number(p.revenue))} جنيه</span>
            </div>
          )) : <p className="admin-empty-text">لا توجد مدفوعات مُقبولة بعد</p>}
        </div>

        <div className="admin-breakdown-section">
          <h5>حسب الطريقة</h5>
          {data.byMethod.length ? data.byMethod.map((m) => (
            <div key={m.method} className="admin-breakdown-row">
              <span>{METHOD_LABELS[m.method] ?? m.method}</span>
              <span>{m.count} طلب · {fmtEgp(Number(m.revenue))} جنيه</span>
            </div>
          )) : <p className="admin-empty-text">لا توجد بيانات</p>}
        </div>

        <div className="admin-breakdown-section">
          <h5>حالة الطلبات</h5>
          <div className="admin-status-row">
            <span className="admin-status-badge admin-status-approved">مقبول: {data.totalApproved}</span>
            <span className="admin-status-badge admin-status-pending">منتظر: {data.totalPending}</span>
            <span className="admin-status-badge admin-status-rejected">مرفوض: {data.totalRejected}</span>
            <span className="admin-status-badge admin-status-rate">نسبة القبول: {approvalRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

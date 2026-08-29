"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  FileSearch,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

export type AdminPayment = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  userName: string | null;
  userEmail: string | null;
  studentName: string | null;
  seatNumber: string;
  seatNumbers: string[];
  productType: "single" | "friends_3";
  method: "vodafone_cash" | "orange_cash" | "instapay" | "discount_code";
  expectedAmount: string;
  senderIdentifier: string;
  transactionReference: string | null;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  hasReceipt: boolean;
};

export type StatusFilter = "all" | AdminPayment["status"];
type ProductFilter = "all" | AdminPayment["productType"];
type MethodFilter = "all" | AdminPayment["method"];
type StatusCounts = Record<StatusFilter, number>;

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "كل الحالات",
  pending: "في الانتظار",
  approved: "مقبولة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

const METHOD_LABELS: Record<AdminPayment["method"], string> = {
  vodafone_cash: "فودافون كاش",
  orange_cash: "أورنج كاش",
  instapay: "إنستا باي",
  discount_code: "كود خصم",
};

const ACTION_LABELS: Record<AdminPayment["status"], string> = {
  pending: "مراجعة",
  approved: "مقبولة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: AdminPayment["status"]) {
  return `admin-status-badge admin-status-${status}`;
}

export function AdminPaymentsTable({
  payments,
  loading,
  statusFilter,
  statusCounts,
  onStatusChange,
  onRefresh,
  onReview,
}: {
  payments: AdminPayment[];
  loading: boolean;
  statusFilter: StatusFilter;
  statusCounts: StatusCounts;
  onStatusChange: (status: StatusFilter) => void;
  onRefresh: () => void;
  onReview: (id: string, action: "approve" | "reject", allowMissingReceipt?: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<ProductFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar-EG");
    return payments.filter((payment) => {
      if (statusFilter !== "all" && payment.status !== statusFilter) return false;
      if (product !== "all" && payment.productType !== product) return false;
      if (method !== "all" && payment.method !== method) return false;
      if (!normalized) return true;
      const searchable = [
        payment.id,
        payment.studentName,
        payment.userName,
        payment.userEmail,
        payment.senderIdentifier,
        payment.transactionReference,
        ...payment.seatNumbers,
      ].filter(Boolean).join(" ").toLocaleLowerCase("ar-EG");
      return searchable.includes(normalized);
    });
  }, [method, payments, product, query, statusFilter]);

  return (
    <section className="admin-panel admin-operations-panel">
      <div className="admin-panel-header">
        <div>
          <div className="admin-section-kicker"><Filter size={14} /> مركز المدفوعات</div>
          <h3 className="admin-panel-title">طلبات الدفع</h3>
          <p className="admin-panel-sub">تفتح الصفحة على الطلبات المنتظرة للمراجعة. غيّر الحالة عند الحاجة.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="admin-refresh-btn">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> تحديث
        </button>
      </div>

      <div className="admin-payment-summary admin-payment-summary-detailed">
        {(["all", "pending", "approved", "rejected", "cancelled"] as const).map((key) => (
          <button
            type="button"
            key={key}
            className={`admin-summary-item admin-summary-filter${statusFilter === key ? " is-selected" : ""}`}
            onClick={() => onStatusChange(key)}
            aria-pressed={statusFilter === key}
            disabled={loading}
          >
            <span>{STATUS_LABELS[key]}</span>
            <strong>{statusCounts[key]}</strong>
          </button>
        ))}
      </div>

      <div className="admin-payment-toolbar" aria-label="فلاتر المدفوعات">
        <label className="admin-filter-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">بحث في المدفوعات</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الجلوس أو الاسم أو رقم العملية" />
        </label>
        <label className="admin-filter-field">
          <span>حالة الطلب</span>
          <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value as StatusFilter)} disabled={loading}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label} ({statusCounts[value as StatusFilter]})</option>)}
          </select>
        </label>
        <label className="admin-filter-field">
          <span>المنتج</span>
          <select value={product} onChange={(event) => setProduct(event.target.value as ProductFilter)}>
            <option value="all">كل المنتجات</option>
            <option value="single">تقرير واحد</option>
            <option value="friends_3">عرض الصحاب</option>
          </select>
        </label>
        <label className="admin-filter-field">
          <span>طريقة الدفع</span>
          <select value={method} onChange={(event) => setMethod(event.target.value as MethodFilter)}>
            <option value="all">كل الطرق</option>
            {Object.entries(METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="admin-table-meta" aria-live="polite">
        {loading ? "جارٍ تحميل الطلبات…" : `عرض ${filtered.length} من ${statusCounts[statusFilter]} طلب · اضغط على «التفاصيل» لعرض بيانات العملية كاملة.`}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-data-table">
          <caption className="sr-only">طلبات الدفع</caption>
          <thead>
            <tr>
              <th>الطلب</th>
              <th>الحالة</th>
              <th>أرقام الجلوس</th>
              <th>المبلغ والطريقة</th>
              <th>تاريخ الطلب</th>
              <th><span className="sr-only">الإجراءات</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((payment) => {
              const expanded = expandedId === payment.id;
              return (
                <Fragment key={payment.id}>
                  <tr className={expanded ? "is-expanded" : undefined}>
                    <td data-label="الطلب">
                      <div className="admin-payment-primary">
                        <strong>{payment.productType === "friends_3" ? "عرض الصحاب · 3 تقارير" : "تقرير فردي"}</strong>
                        <span>{payment.studentName ?? "شراء بدون حساب"}</span>
                      </div>
                    </td>
                    <td data-label="الحالة">
                      <span className={statusClass(payment.status)}>{ACTION_LABELS[payment.status]}</span>
                      {payment.status === "pending" && !payment.hasReceipt ? <small className="admin-inline-warning">الإيصال ناقص</small> : null}
                    </td>
                    <td data-label="أرقام الجلوس">
                      <div className="admin-seat-chips">{payment.seatNumbers.map((seat) => <bdi key={seat}>{seat}</bdi>)}</div>
                    </td>
                    <td data-label="المبلغ والطريقة">
                      <strong className="admin-amount">{payment.expectedAmount} جنيه</strong>
                      <span className="admin-muted-line">{METHOD_LABELS[payment.method]}</span>
                    </td>
                    <td data-label="التاريخ"><time dateTime={payment.createdAt}>{formatDate(payment.createdAt)}</time></td>
                    <td data-label="الإجراءات">
                      <div className="admin-row-actions">
                        {payment.hasReceipt ? <a className="admin-btn admin-btn-outline" href={`/api/admin/payments/${payment.id}/receipt`} target="_blank" rel="noreferrer"><FileSearch size={15} /> الإيصال</a> : <span className="admin-no-receipt">بدون إيصال</span>}
                        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setExpandedId(expanded ? null : payment.id)} aria-expanded={expanded}>
                          تفاصيل <ChevronDown size={15} className={expanded ? "rotate-180" : ""} />
                        </button>
                        {payment.status === "pending" ? <>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              if (!payment.hasReceipt && !window.confirm("الطلب بدون إيصال. هل تريد قبوله وفتح التقرير رغم ذلك؟ سيتم تسجيل القرار في سجل التدقيق.")) return;
                              onReview(payment.id, "approve", !payment.hasReceipt);
                            }}
                            className="admin-btn admin-btn-approve"
                          ><Check size={15} /> {payment.hasReceipt ? "قبول" : "قبول بدون إيصال"}</button>
                          <button type="button" disabled={loading} onClick={() => onReview(payment.id, "reject")} className="admin-btn admin-btn-reject"><X size={15} /> رفض</button>
                        </> : null}
                      </div>
                    </td>
                  </tr>
                  {expanded ? <tr key={`${payment.id}-details`} className="admin-detail-row"><td colSpan={6}>
                    <div className="admin-payment-details">
                      <div><span>رقم العملية</span><bdi>{payment.id}</bdi></div>
                      <div><span>بيانات المرسل</span><bdi>{payment.senderIdentifier || "—"}</bdi></div>
                      <div><span>مرجع العملية</span><bdi>{payment.transactionReference || "—"}</bdi></div>
                      <div><span>أُرسل في</span><span>{formatDate(payment.submittedAt)}</span></div>
                      <div><span>تمت المراجعة</span><span>{formatDate(payment.reviewedAt)}</span></div>
                      <div><span>الحساب</span><span>{payment.userEmail || "شراء زائر"}</span></div>
                      {payment.rejectionReason ? <div className="admin-detail-reason"><span>سبب الرفض</span><span>{payment.rejectionReason}</span></div> : null}
                    </div>
                  </td></tr> : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length ? <div className="admin-empty-state"><FileSearch size={25} /><strong>لا توجد مدفوعات بهذا الفلتر</strong><span>جرّب تغيير الحالة أو البحث برقم الجلوس.</span></div> : null}
    </section>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, History, RefreshCw, Search } from "lucide-react";

type AuditLog = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "payment.approve": "قبول دفعة",
  "payment.reject": "رفض دفعة",
  "payment.approve_duplicate": "دفعة مكررة",
  "entitlement.manual_grant": "تفعيل مباشر لرقم جلوس",
  "settings.update": "تعديل الإعدادات",
  "model.activate": "تفعيل نموذج",
  "admin.role_update": "تعديل صلاحية",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function labelAction(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function AdminAuditTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/audit-log?limit=500", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLogs(data.logs ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل سجل التدقيق.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar-EG");
    return logs.filter((log) => {
      if (action !== "all" && log.action !== action) return false;
      if (!normalized) return true;
      return [log.action, log.targetType, log.targetId, log.actorName, log.actorEmail].filter(Boolean).join(" ").toLocaleLowerCase("ar-EG").includes(normalized);
    });
  }, [action, logs, query]);

  return (
    <section className="admin-panel admin-operations-panel">
      <div className="admin-panel-header">
        <div>
          <div className="admin-section-kicker"><History size={14} /> سجل الحركة</div>
          <h3 className="admin-panel-title">سجل التدقيق</h3>
          <p className="admin-panel-sub">كل إجراء إداري مسجل بالوقت والحساب والتفاصيل السابقة واللاحقة.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="admin-refresh-btn"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> تحديث</button>
      </div>
      <div className="admin-payment-toolbar">
        <label className="admin-filter-search"><Search size={16} aria-hidden="true" /><span className="sr-only">بحث في سجل التدقيق</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الإجراء أو الهدف أو البريد" /></label>
        <label className="admin-filter-field"><span>نوع الإجراء</span><select value={action} onChange={(event) => setAction(event.target.value)}><option value="all">كل الإجراءات</option>{actions.map((value) => <option key={value} value={value}>{labelAction(value)}</option>)}</select></label>
      </div>
      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      <div className="admin-table-meta">عرض {filtered.length} من {logs.length} سجل</div>
      <div className="admin-table-wrap">
        <table className="admin-data-table admin-audit-data-table">
          <caption className="sr-only">سجل التدقيق الإداري</caption>
          <thead><tr><th>التاريخ</th><th>المسؤول</th><th>الإجراء</th><th>الهدف</th><th>التفاصيل</th></tr></thead>
          <tbody>
            {filtered.map((log) => {
              const expanded = expandedId === log.id;
              return <Fragment key={log.id}>
                <tr className={expanded ? "is-expanded" : undefined}>
                  <td data-label="التاريخ"><time dateTime={log.createdAt}>{formatDate(log.createdAt)}</time></td>
                  <td data-label="المسؤول"><div className="admin-payment-primary"><strong>{log.actorName || "حساب غير معروف"}</strong><span>{log.actorEmail || log.actorUserId || "—"}</span></div></td>
                  <td data-label="الإجراء"><span className="admin-audit-action">{labelAction(log.action)}</span></td>
                  <td data-label="الهدف"><bdi>{log.targetType}</bdi><small className="admin-muted-line"><bdi>{log.targetId}</bdi></small></td>
                  <td data-label="التفاصيل"><button type="button" className="admin-btn admin-btn-ghost" onClick={() => setExpandedId(expanded ? null : log.id)} aria-expanded={expanded}>عرض التغيير <ChevronDown size={15} className={expanded ? "rotate-180" : ""} /></button></td>
                </tr>
                {expanded ? <tr key={`${log.id}-details`} className="admin-detail-row"><td colSpan={5}><div className="admin-audit-details"><div><strong>قبل</strong><pre>{JSON.stringify(log.beforeJson ?? {}, null, 2)}</pre></div><div><strong>بعد</strong><pre>{JSON.stringify(log.afterJson ?? {}, null, 2)}</pre></div>{log.requestId ? <small>Request ID: <bdi>{log.requestId}</bdi></small> : null}</div></td></tr> : null}
              </Fragment>;
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && !loading ? <div className="admin-empty-state"><History size={25} /><strong>لا توجد أحداث مطابقة</strong><span>سجل التدقيق سيظهر هنا بعد أي مراجعة أو تعديل.</span></div> : null}
    </section>
  );
}

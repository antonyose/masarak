"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy, Plus, Tag } from "lucide-react";

type CodeRow = { id: string; code: string; discountType: "percentage" | "fixed"; discountValue: string; maxRedemptions: number; usedCount: number; active: boolean; expiresAt: string | null };

export function AdminDiscountCodes() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/admin/discount-codes", { cache: "no-store" });
    if (response.ok) setCodes((await response.json()).codes);
  }
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    const rawExpiry = String(data.get("expiresAt") ?? "");
    try {
      const response = await fetch("/api/admin/discount-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        code: String(data.get("code") ?? "").trim() || undefined,
        discountType: data.get("discountType"), discountValue: Number(data.get("discountValue")),
        maxRedemptions: Number(data.get("maxRedemptions")), expiresAt: rawExpiry ? new Date(rawExpiry).toISOString() : null,
      }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setMessage(`تم إنشاء الكود ${result.code.code}`); form.reset(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر إنشاء الكود."); }
    finally { setLoading(false); }
  }

  async function toggle(row: CodeRow) {
    const response = await fetch(`/api/admin/discount-codes/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !row.active }) });
    if (response.ok) await load(); else setError((await response.json()).error);
  }

  return <section className="admin-panel admin-discount-panel">
    <div className="admin-panel-header"><div><div className="admin-section-kicker"><Tag size={15}/> أكواد التسويق</div><h3 className="admin-panel-title">أكواد الخصم</h3><p className="admin-panel-sub">أنشئ كودًا قصيرًا لأول عدد محدد من الاستخدامات. الخصم الكامل يفتح التقرير فورًا.</p></div></div>
    <form className="admin-discount-form" onSubmit={create}>
      <label><span>الكود <small>اختياري</small></span><input name="code" maxLength={4} pattern="[A-Za-z0-9]{4}" placeholder="تلقائي" /></label>
      <label><span>نوع الخصم</span><select name="discountType" defaultValue="percentage"><option value="percentage">نسبة %</option><option value="fixed">مبلغ بالجنيه</option></select></label>
      <label><span>قيمة الخصم</span><input name="discountValue" type="number" min="0.01" max="10000" step="0.01" defaultValue="100" required /></label>
      <label><span>عدد الاستخدامات</span><input name="maxRedemptions" type="number" min="1" max="100000" defaultValue="50" required /></label>
      <label><span>ينتهي في <small>اختياري</small></span><input name="expiresAt" type="datetime-local" /></label>
      <button className="admin-btn admin-btn-approve" disabled={loading}><Plus size={16}/>{loading ? "جارٍ الإنشاء…" : "إنشاء الكود"}</button>
    </form>
    {message ? <p className="admin-success">{message}</p> : null}{error ? <p className="admin-error">{error}</p> : null}
    <div className="admin-discount-list">{codes.map((row) => <div key={row.id} className="admin-discount-row">
      <button type="button" className="admin-code-copy" onClick={() => navigator.clipboard.writeText(row.code)}><bdi>{row.code}</bdi><Copy size={13}/></button>
      <span>{row.discountType === "percentage" ? `${Number(row.discountValue)}%` : `${Number(row.discountValue)} جنيه`}</span>
      <span>{row.usedCount} / {row.maxRedemptions} استخدام</span>
      <span>{row.expiresAt ? new Date(row.expiresAt).toLocaleString("ar-EG") : "بدون انتهاء"}</span>
      <button type="button" className={`admin-status-toggle ${row.active ? "is-active" : ""}`} onClick={() => void toggle(row)}>{row.active ? "مفعّل" : "متوقف"}</button>
    </div>)}</div>
  </section>;
}

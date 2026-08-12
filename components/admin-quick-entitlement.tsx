"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, Banknote, Loader2 } from "lucide-react";

export function AdminQuickEntitlement({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [recordRevenue, setRecordRevenue] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: 2026,
          seatNumber: String(form.get("seatNumber") ?? ""),
          recordRevenue,
          amount: recordRevenue ? Number(form.get("amount")) : 0,
          method: recordRevenue ? String(form.get("method")) : null,
          note: String(form.get("note") ?? ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "تعذر تنفيذ التفعيل.");
      setMessage(`تم تفعيل ${result.seatNumber} — ${result.studentName}${result.recordRevenue ? " واحتساب الإيراد." : " بدون احتساب إيراد."}`);
      formElement.reset();
      setRecordRevenue(true);
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تنفيذ التفعيل.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-panel admin-quick-grant-panel">
      <div className="admin-panel-header">
        <div>
          <div className="admin-section-kicker"><BadgeCheck size={15} /> تفعيل سريع</div>
          <h3 className="admin-panel-title">افتح التقرير برقم الجلوس</h3>
          <p className="admin-panel-sub">التفعيل فوري لكل مراحل 2026، مع اختيار تسجيل المبلغ في الإيرادات أو اعتباره تفعيلًا مجانيًا.</p>
        </div>
      </div>
      <form className="admin-quick-grant-form" onSubmit={submit}>
        <label className="admin-filter-field admin-quick-seat">
          <span>رقم الجلوس</span>
          <input name="seatNumber" inputMode="numeric" pattern="[0-9٠-٩۰-۹]{4,14}" required placeholder="مثال: 2537449" />
        </label>
        <label className="admin-filter-field">
          <span>المبلغ</span>
          <input name="amount" type="number" min="1" max="10000" step="0.01" defaultValue="35" disabled={!recordRevenue} required={recordRevenue} />
        </label>
        <label className="admin-filter-field">
          <span>طريقة التحصيل</span>
          <select name="method" defaultValue="vodafone_cash" disabled={!recordRevenue} required={recordRevenue}>
            <option value="vodafone_cash">فودافون كاش</option>
            <option value="orange_cash">أورنج كاش</option>
            <option value="instapay">إنستاباي</option>
          </select>
        </label>
        <label className="admin-filter-field admin-quick-note">
          <span>ملاحظة اختيارية</span>
          <input name="note" maxLength={500} placeholder="سبب التفعيل أو مرجع التحويل" />
        </label>
        <label className="admin-revenue-toggle">
          <input type="checkbox" checked={recordRevenue} onChange={(event) => setRecordRevenue(event.target.checked)} />
          <span><Banknote size={16} /> احتساب المبلغ ضمن الإيرادات</span>
        </label>
        <button type="submit" disabled={loading} className="admin-btn admin-btn-approve admin-quick-submit">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
          تفعيل التقرير الآن
        </button>
      </form>
      {message ? <p className="admin-success" role="status">{message}</p> : null}
      {error ? <p className="admin-error" role="alert">{error}</p> : null}
    </section>
  );
}

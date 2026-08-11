"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { AdminSettingsForm } from "@/components/admin-settings-form";

type Payment = { id: string; userName: string; userEmail: string; studentName: string; seatNumber: string; method: string; expectedAmount: string; senderIdentifier: string; transactionReference: string | null; submittedAt: string; hasReceipt: boolean };
type Coordination = { counts: { sources: number; officialCutoffs2026: number; stageVacancies2026: number }; models: Array<{ id: string; version: string; year: number; stage: number; activatedAt: string | null }> };

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coordination, setCoordination] = useState<Coordination | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true); setError("");
    const [queue, data] = await Promise.all([fetch("/api/admin/payments?status=pending"), fetch("/api/admin/coordination")]);
    if (!queue.ok || !data.ok) setError(queue.status === 403 || data.status === 403 ? "هذا الحساب لا يملك صلاحية الأدمن." : "تعذر تحميل لوحة الإدارة.");
    else { setPayments((await queue.json()).payments); setCoordination(await data.json()); }
    setLoading(false);
  }
  useEffect(() => { if (session?.user) void load(); }, [session?.user]);
  async function review(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("سبب الرفض الظاهر للمستخدم:") : undefined;
    if (action === "reject" && (!reason || reason.trim().length < 3)) return;
    setLoading(true); const response = await fetch(`/api/admin/payments/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "approve" ? { action } : { action, reason }) }); const result = await response.json();
    if (!response.ok) setError(result.error); else await load(); setLoading(false);
  }
  if (isPending) return <div className="admin-container"><div className="admin-card">جارٍ التحقق…</div></div>;
  if (!session?.user) return <div className="admin-container"><div className="admin-card text-center"><p>استخدم حساب Better Auth المرقّى للوصول.</p><Link href="/login" className="mt-4 inline-flex bg-teal-700 px-5 py-3 font-bold text-white">تسجيل الدخول</Link></div></div>;
  return <div className="admin-container">
    <div className="admin-header-row"><div><h2>لوحة تشغيل مسارك 2026</h2><p>المراجعة المالية، حالة بيانات التنسيق، والنموذج النشط.</p></div><button onClick={load} disabled={loading} className="secondary-button"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />تحديث</button></div>
    {error ? <p className="form-error">{error}</p> : null}
    {coordination ? <div className="stats-grid"><div className="stat-card"><div className="stat-content"><span>المصادر</span><strong>{coordination.counts.sources}</strong></div></div><div className="stat-card"><div className="stat-content"><span>حقائق المرحلة الأولى</span><strong>{coordination.counts.officialCutoffs2026}</strong></div></div><div className="stat-card"><div className="stat-content"><span>شواغر المرحلة الثانية</span><strong>{coordination.counts.stageVacancies2026}</strong></div></div><div className="stat-card"><div className="stat-content"><span>النماذج النشطة</span><strong>{coordination.models.filter((model) => model.activatedAt).length}</strong></div></div></div> : null}
    <section className="mt-6 border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold text-[#173a55]">طلبات الدفع المنتظرة</h3><p className="text-sm text-slate-500">لا توافق قبل مطابقة الإيصال والمرجع يدويًا.</p></div><div className="flex gap-3 text-sm font-bold"><Link href="/api/admin/settings" className="text-teal-800 underline">إعدادات JSON</Link><Link href="/api/admin/audit-log" className="text-teal-800 underline">سجل التدقيق</Link></div></div>
      <div className="mt-4 grid gap-3">{payments.map((payment) => <article key={payment.id} className="border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-4"><div><strong>{payment.studentName} — {payment.seatNumber}</strong><p className="text-sm text-slate-500">{payment.userName} · {payment.userEmail}</p><p className="mt-2 text-sm">{payment.expectedAmount} EGP · {payment.method} · المُرسِل {payment.senderIdentifier}{payment.transactionReference ? ` · المرجع ${payment.transactionReference}` : ""}</p></div><div className="flex items-start gap-2">{payment.hasReceipt ? <a href={`/api/admin/payments/${payment.id}/receipt`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 border border-slate-300 px-3 text-sm font-bold">الإيصال <ExternalLink size={14} /></a> : null}<button disabled={loading || !payment.hasReceipt} onClick={() => review(payment.id, "approve")} className="inline-flex min-h-10 items-center gap-1 bg-teal-700 px-3 text-sm font-bold text-white disabled:opacity-40"><Check size={15} />موافقة</button><button disabled={loading} onClick={() => review(payment.id, "reject")} className="inline-flex min-h-10 items-center gap-1 border border-red-300 px-3 text-sm font-bold text-red-700"><X size={15} />رفض</button></div></div></article>)}{!payments.length ? <p className="bg-slate-50 p-5 text-center text-slate-500">لا توجد طلبات مكتملة الإرسال في الانتظار.</p> : null}</div>
    </section>
    <section className="mt-6 border border-slate-200 bg-white p-5"><h3 className="text-xl font-extrabold text-[#173a55]">إعدادات الدفع والعرض المجاني</h3><p className="text-sm text-slate-500">تُقرأ هذه القيم من Neon عند إنشاء الطلب ولا تُحفظ داخل مكونات العرض.</p><AdminSettingsForm /></section>
  </div>;
}

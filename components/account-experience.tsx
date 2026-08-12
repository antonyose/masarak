"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

type Account = { name: string; email: string; phone: string | null; role: string };
type Student = { id: string; studentNameSnapshot: string; seatNumber: string; percentageSnapshot: number; branch: string };
type Prediction = { id: string; savedStudentId: string; coordinationStage: number; percentage: number; branch: string; createdAt: string };
type Payment = { id: string; predictionId: string; method: string; expectedAmount: string; status: string; hasReceipt: boolean; rejectionReason?: string };
type Settings = { priceEgp: string; methods: Array<{ id: string; label: string; recipient: string; deepLink?: string }>; instructions: string; receiptRequired: boolean };

export function AccountExperience() {
  const { data: session, isPending } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [a, s, p, pay, config] = await Promise.all([fetch("/api/account"), fetch("/api/saved-students"), fetch("/api/predictions"), fetch("/api/payments"), fetch("/api/payment-settings")]);
    if (a.ok) setAccount((await a.json()).account);
    if (s.ok) setStudents((await s.json()).students);
    if (p.ok) setPredictions((await p.json()).predictions);
    if (pay.ok) setPayments((await pay.json()).payments);
    if (config.ok) setSettings(await config.json());
  }
  useEffect(() => { if (session?.user) { setSelectedPrediction(new URLSearchParams(window.location.search).get("prediction") ?? ""); void load(); } }, [session?.user]);

  async function updateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), phone: data.get("phone") }) });
    const result = await response.json(); setMessage(response.ok ? "تم حفظ بيانات الحساب." : result.error); setLoading(false); if (response.ok) setAccount(result.account);
  }
  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); const data = new FormData(event.currentTarget); const receipt = data.get("receipt");
    try {
      const prediction = predictions.find((item) => item.id === data.get("predictionId"));
      const student = students.find((item) => item.id === prediction?.savedStudentId);
      if (!prediction || !student) throw new Error("النتيجة المحفوظة غير موجودة.");
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ predictionId: prediction.id, year: 2026, productType: "single", seatNumbers: [student.seatNumber], method: data.get("method"), transactionReference: data.get("transactionReference") || undefined, idempotencyKey: crypto.randomUUID() }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      if (result.payment.status === "approved") { setMessage("تم تفعيل التقرير فورًا."); setSelectedPrediction(""); await load(); return; }
      if (!(receipt instanceof File) || !receipt.size) {
        if (settings?.receiptRequired) throw new Error("اختر صورة الإيصال.");
        setMessage("تم إرسال طلب التفعيل."); setSelectedPrediction(""); await load(); return;
      }
      const form = new FormData(); form.set("receipt", receipt); const uploaded = await fetch(`/api/payments/${result.payment.id}/receipt`, { method: "POST", body: form }); const uploadResult = await uploaded.json(); if (!uploaded.ok) throw new Error(uploadResult.error);
      setMessage("تم إرسال الإيصال للمراجعة. لا تُجرِ تحويلًا تجريبيًا دون تصريح."); setSelectedPrediction(""); await load();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "تعذر إرسال الدفع."); }
    finally { setLoading(false); }
  }
  if (isPending) return <div className="bg-white p-8">جارٍ تحميل الحساب…</div>;
  if (!session?.user) return <div className="border border-slate-200 bg-white p-8 text-center"><p>يجب تسجيل الدخول لعرض الحساب.</p><Link href="/login" className="mt-4 inline-flex bg-teal-700 px-5 py-3 font-bold text-white">دخول أو حساب جديد</Link></div>;
  return <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
    <div className="grid content-start gap-6">
      <form onSubmit={updateAccount} className="border border-slate-200 bg-white p-5"><h2 className="text-xl font-extrabold text-[#173a55]">بيانات الحساب</h2><label className="mt-4 grid gap-1 text-sm font-bold">الاسم<input name="name" defaultValue={account?.name ?? ""} required className="min-h-11 border border-slate-300 px-3" /></label><label className="mt-3 grid gap-1 text-sm font-bold">البريد<input value={account?.email ?? ""} disabled className="min-h-11 border border-slate-200 bg-slate-50 px-3 ltr-number" /></label><label className="mt-3 grid gap-1 text-sm font-bold">رقم الموبايل<input name="phone" defaultValue={account?.phone ?? ""} required className="min-h-11 border border-slate-300 px-3 ltr-number" /></label><button disabled={loading} className="mt-4 min-h-11 bg-teal-700 px-5 font-bold text-white">حفظ البيانات</button>{account?.role === "admin" ? <Link href="/admin" className="mr-3 text-sm font-bold text-teal-800 underline">لوحة الإدارة</Link> : null}</form>
      <div className="border border-slate-200 bg-white p-5"><h2 className="text-xl font-extrabold text-[#173a55]">النتائج المحفوظة</h2><div className="mt-3 grid gap-2">{students.map((student) => <div key={student.id} className="bg-slate-50 p-3"><strong>{student.studentNameSnapshot}</strong><p className="text-sm text-slate-500">{student.seatNumber} · {student.percentageSnapshot}% · {student.branch}</p></div>)}{!students.length ? <p className="text-sm text-slate-500">لا توجد نتائج محفوظة بعد.</p> : null}</div></div>
    </div>
    <div className="grid content-start gap-6">
      <div className="border border-slate-200 bg-white p-5"><h2 className="text-xl font-extrabold text-[#173a55]">سجل التوقعات</h2><div className="mt-3 grid gap-2">{predictions.map((prediction) => <div key={prediction.id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 p-3"><div><strong>المرحلة {prediction.coordinationStage} — {prediction.percentage}%</strong><p className="text-xs text-slate-500">{new Date(prediction.createdAt).toLocaleString("ar-EG")}</p></div><div className="flex gap-2"><Link href={`/account/reports/${prediction.id}`} className="border border-slate-300 px-3 py-2 text-xs font-bold">التقرير الكامل</Link><button onClick={() => setSelectedPrediction(prediction.id)} className="bg-[#173a55] px-3 py-2 text-xs font-bold text-white">تفعيل</button></div></div>)}{!predictions.length ? <p className="text-sm text-slate-500">لا يوجد سجل توقعات بعد.</p> : null}</div></div>
      {selectedPrediction && settings ? <form onSubmit={submitPayment} className="border-2 border-teal-700 bg-white p-5"><h2 className="text-xl font-extrabold text-[#173a55]">افتح تقريرك الكامل — {settings.priceEgp} جنيه</h2><p className="mt-1 text-sm text-slate-500">كل الترشيحات المناسبة ليك، وتحديثات المرحلة الثانية والثالثة لنفس النتيجة. {settings.instructions}</p><input type="hidden" name="predictionId" value={selectedPrediction} /><label className="mt-4 grid gap-1 text-sm font-bold">طريقة الدفع<select name="method" required className="min-h-11 border border-slate-300 px-3">{settings.methods.map((method) => <option key={method.id} value={method.id}>{method.label} — {method.recipient}</option>)}</select></label><label className="mt-3 grid gap-1 text-sm font-bold">مرجع العملية (اختياري)<input name="transactionReference" className="min-h-11 border border-slate-300 px-3" /></label><label className="mt-3 grid gap-1 text-sm font-bold">صورة الإيصال {settings.receiptRequired ? "— JPEG/PNG/WebP حتى 5MB" : "(اختيارية)"}<input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required={settings.receiptRequired} className="border border-slate-300 p-3" /></label><button disabled={loading} className="mt-4 min-h-11 bg-teal-700 px-5 font-bold text-white">إرسال طلب التفعيل</button></form> : null}
      <div className="border border-slate-200 bg-white p-5"><h2 className="text-xl font-extrabold text-[#173a55]">طلبات الدفع</h2><div className="mt-3 grid gap-2">{payments.map((payment) => <div key={payment.id} className="bg-slate-50 p-3"><strong>{payment.expectedAmount} EGP — {payment.status}</strong><p className="text-sm text-slate-500">{payment.method} · {payment.hasReceipt ? "تم رفع الإيصال" : "الإيصال غير مرفوع"}</p>{payment.rejectionReason ? <p className="text-sm text-red-700">{payment.rejectionReason}</p> : null}</div>)}{!payments.length ? <p className="text-sm text-slate-500">لا توجد طلبات.</p> : null}</div></div>
      {message ? <p className="border-r-4 border-teal-700 bg-teal-50 p-3 font-bold text-teal-900">{message}</p> : null}
    </div>
  </div>;
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, LockKeyhole, Search, Sparkles } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { egyptianGovernorates } from "@/lib/governorates";

type Tool = "search" | "predict";
type Branch = "science" | "mathematics" | "literary";
type System = "new" | "old";
type StudentResult = {
  year: number;
  seatNumber: string;
  studentName: string;
  educationSystem: System | "unknown";
  branch: Branch | "unknown";
  branchLabel: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  resultStatus: string;
  governorate: string | null;
};
type Recommendation = {
  id: string;
  officialNameArabic: string;
  category: "safe" | "target" | "reach" | "unlikely" | "insufficient_data";
  predictedCutoffPercentage: number;
  expectedRange: [number, number];
  confidence: string;
  proximityLabel: string;
  explanation: string;
  requiresAptitudeTest: boolean;
};
type PredictionResponse = {
  predictionId?: string;
  eligibility: { eligible: boolean; message: string; minimumScore: number };
  modelMode: "rank_percentile" | "normalized_percentage";
  confidence: string;
  recommendations: Recommendation[];
  lockedRecommendationCount?: number;
  totalRecommendationCount?: number;
  premium?: boolean;
  disclaimer: string;
};

const branchLabels: Record<Branch, string> = {
  science: "علمي علوم",
  mathematics: "علمي رياضة",
  literary: "أدبي",
};
const categoryLabels: Record<Recommendation["category"], string> = {
  safe: "آمن",
  target: "مناسب",
  reach: "طموح",
  unlikely: "احتمال ضعيف",
  insufficient_data: "بيانات غير كافية",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}{children}</label>;
}

export function ToolExperience({ initialTool = "search" }: { initialTool?: Tool }) {
  const { data: session } = useSession();
  const [tool, setTool] = useState<Tool>(initialTool);
  const [method, setMethod] = useState<"seat" | "name">("seat");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [system, setSystem] = useState<System>("new");
  const [branch, setBranch] = useState<Branch | "">("");
  const [score, setScore] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [report, setReport] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const maxScore = system === "new" ? 320 : 410;
  const percentage = useMemo(() => {
    const value = Number(score);
    return Number.isFinite(value) ? Math.round((value / maxScore) * 10_000) / 100 : 0;
  }, [score, maxScore]);

  async function searchResults(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setReport(null);
    try {
      const response = await fetch("/api/result-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: 2026, method, query }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResults(data.results);
      if (!data.results.length) setError(data.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر البحث الآن.");
    } finally { setLoading(false); }
  }

  function useResult(result: StudentResult) {
    if (result.totalScore == null || result.maxScore == null || result.educationSystem === "unknown") {
      setError("هذه النتيجة لا تحتوي على بيانات مجموع مكتملة."); return;
    }
    setSelectedResult(result);
    setSystem(result.educationSystem);
    setScore(String(result.totalScore));
    setBranch(result.branch === "unknown" ? "" : result.branch);
    if (result.governorate && egyptianGovernorates.includes(result.governorate as (typeof egyptianGovernorates)[number])) setGovernorate(result.governorate);
    setTool("predict"); setReport(null); setError("");
  }

  async function predict(event: FormEvent) {
    event.preventDefault();
    if (!branch) { setError("اختر الشعبة بنفسك؛ بيانات نتيجة 2026 لا تحتوي على شعبة موثقة."); return; }
    setLoading(true); setError(""); setReport(null);
    try {
      if (selectedResult) {
        if (!session?.user) throw new Error("سجّل الدخول لحفظ النتيجة وإنشاء تقرير مرتبط بها.");
        const savedResponse = await fetch("/api/saved-students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: 2026, seatNumber: selectedResult.seatNumber, branch }) });
        const saved = await savedResponse.json();
        if (!savedResponse.ok) throw new Error(saved.error);
        const predictionResponse = await fetch("/api/predictions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savedStudentId: saved.student.id, governorate: governorate || undefined }) });
        const prediction = await predictionResponse.json();
        if (!predictionResponse.ok) throw new Error(prediction.error);
        setReport(prediction);
      } else {
        const response = await fetch("/api/predictions/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: 2026, educationSystem: system, branch, score: Number(score), percentage, governorate: governorate || undefined }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setReport(data);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر إنشاء التوقع."); }
    finally { setLoading(false); }
  }

  return (
    <div className="overflow-hidden border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,42,61,.1)]">
      <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 p-1.5">
        <button type="button" onClick={() => setTool("search")} className={`min-h-12 px-4 font-bold ${tool === "search" ? "bg-[#123b56] text-white" : "text-slate-600 hover:bg-white"}`}><Search className="ml-2 inline" size={18} />البحث عن النتيجة</button>
        <button type="button" onClick={() => setTool("predict")} className={`min-h-12 px-4 font-bold ${tool === "predict" ? "bg-[#123b56] text-white" : "text-slate-600 hover:bg-white"}`}><Sparkles className="ml-2 inline" size={18} />توقع المرحلة الثانية</button>
      </div>

      <div className="p-5 md:p-8">
        {tool === "search" ? (
          <div className="grid gap-7 lg:grid-cols-[.8fr_1.2fr]">
            <form onSubmit={searchResults} className="grid content-start gap-5">
              <div><h2 className="text-2xl font-extrabold text-[#173a55]">نتيجة الثانوية العامة 2026</h2><p className="mt-1 text-sm text-slate-500">البحث المباشر في قاعدة النتائج، دون تخزين بيانات البحث في المتصفح.</p></div>
              <div className="grid grid-cols-2 border border-slate-200 p-1"><button type="button" onClick={() => setMethod("seat")} className={`p-2.5 font-bold ${method === "seat" ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}>رقم الجلوس</button><button type="button" onClick={() => setMethod("name")} className={`p-2.5 font-bold ${method === "name" ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}>الاسم</button></div>
              <Field label={method === "seat" ? "رقم الجلوس الكامل" : "الاسم أو جزء متعدد الكلمات"}><input className="min-h-12 border border-slate-300 bg-white px-4 outline-none focus:border-teal-600" value={query} onChange={(event) => setQuery(event.target.value)} inputMode={method === "seat" ? "numeric" : "text"} required /></Field>
              <button className="min-h-12 bg-teal-700 px-5 font-extrabold text-white hover:bg-teal-800 disabled:opacity-60" disabled={loading}>{loading ? "جارٍ البحث…" : "ابحث الآن"}</button>
            </form>
            <div className="grid content-start gap-3" aria-live="polite">
              {!results.length && !error ? <div className="border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500"><Search className="mx-auto mb-3 text-teal-700" /><p>ستظهر النتائج المطابقة هنا.</p></div> : null}
              {results.map((result) => <article key={result.seatNumber} className="border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#173a55]">{result.studentName}</h3><p className="mt-1 text-sm text-slate-500">رقم الجلوس <span className="ltr-number font-bold">{result.seatNumber}</span> · {result.totalScore ?? "—"} / {result.maxScore ?? "—"} · {result.percentage ?? "—"}%</p></div><button onClick={() => useResult(result)} className="border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50">استخدم النتيجة <ArrowLeft className="mr-1 inline" size={15} /></button></div></article>)}
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[.78fr_1.22fr]">
            <form onSubmit={predict} className="grid content-start gap-4">
              <div><h2 className="text-2xl font-extrabold text-[#173a55]">توقعات المرحلة الثانية</h2><p className="mt-1 text-sm text-slate-500">{selectedResult ? `نتيجة ${selectedResult.studentName} — رقم ${selectedResult.seatNumber}` : "المجموع اليدوي يعرض معاينة مجانية فقط ولا يمكن حفظه أو الدفع له."}</p></div>
              <Field label="نظام الثانوية"><select value={system} disabled={Boolean(selectedResult)} onChange={(event) => setSystem(event.target.value as System)} className="min-h-12 border border-slate-300 px-3"><option value="new">النظام الحديث / 320</option><option value="old">النظام القديم / 410</option></select></Field>
              <Field label="الشعبة (إقرار مطلوب)"><select value={branch} onChange={(event) => setBranch(event.target.value as Branch)} className="min-h-12 border border-slate-300 px-3" required><option value="">اختر الشعبة بنفسك</option>{Object.entries(branchLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label={`المجموع من ${maxScore}`}><input type="number" step="0.1" min="0" max={maxScore} value={score} disabled={Boolean(selectedResult)} onChange={(event) => setScore(event.target.value)} className="min-h-12 border border-slate-300 px-3" required /></Field><Field label="النسبة المحسوبة"><output className="flex min-h-12 items-center border border-slate-200 bg-slate-50 px-3 font-bold ltr-number">{percentage || 0}%</output></Field></div>
              <Field label="المحافظة (لترتيب القرب)"><select value={governorate} onChange={(event) => setGovernorate(event.target.value)} className="min-h-12 border border-slate-300 px-3"><option value="">غير محددة</option>{egyptianGovernorates.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <button className="min-h-12 bg-teal-700 px-5 font-extrabold text-white hover:bg-teal-800 disabled:opacity-60" disabled={loading}>{loading ? "جارٍ الحساب…" : selectedResult ? "احفظ النتيجة وأنشئ التقرير" : "اعرض المعاينة المجانية"}</button>
              {selectedResult && !session?.user ? <Link href="/login" className="text-center text-sm font-bold text-teal-800 underline">سجّل الدخول أولًا لحفظ النتيجة</Link> : null}
            </form>
            <div className="grid content-start gap-4" aria-live="polite">
              {!report ? <div className="border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500"><BookOpenCheck className="mx-auto mb-3 text-teal-700" /><p>اختر الشعبة وأدخل المجموع لعرض التوقع.</p></div> : <Report report={report} />}
            </div>
          </div>
        )}
        {error ? <p role="alert" className="mt-5 border-r-4 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
      </div>
    </div>
  );
}

function Report({ report }: { report: PredictionResponse }) {
  return <>
    <div className={`border-r-4 p-4 ${report.eligibility.eligible ? "border-teal-600 bg-teal-50" : "border-amber-600 bg-amber-50"}`}><div className="flex flex-wrap justify-between gap-2"><strong>{report.eligibility.message}</strong><span className="text-sm">الثقة: {report.confidence}</span></div><p className="mt-1 text-xs text-slate-600">وضع النموذج: نسبة مئوية معيارية — لا يتم اختلاق ترتيب للشعبة.</p></div>
    {report.recommendations.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#173a55]">{item.officialNameArabic}</h3><p className="mt-1 text-sm text-slate-600">النطاق المتوقع {item.expectedRange[0]}%–{item.expectedRange[1]}% · {item.proximityLabel}</p></div><span className="shrink-0 bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-800">{categoryLabels[item.category]}</span></div><p className="mt-3 text-sm text-slate-600">{item.explanation}</p>{item.requiresAptitudeTest ? <p className="mt-2 text-xs font-bold text-amber-800">قد يتطلب اختبار قدرات.</p> : null}</article>)}
    {report.lockedRecommendationCount ? <div className="border border-slate-300 bg-slate-50 p-5 text-center"><LockKeyhole className="mx-auto mb-2 text-[#173a55]" /><strong>هناك {report.lockedRecommendationCount} خيارات إضافية داخل التقرير الكامل</strong><p className="mt-1 text-sm text-slate-500">التفعيل يتم من الخادم بعد مراجعة الدفع، وليس من تخزين المتصفح.</p>{report.predictionId ? <Link href={`/account?prediction=${report.predictionId}`} className="mt-4 inline-flex min-h-11 items-center bg-[#173a55] px-5 font-bold text-white">راجع سعر التفعيل وطرق الدفع في حسابك</Link> : <p className="mt-3 text-xs text-slate-500">استخدم نتيجة حقيقية برقم الجلوس وسجّل الدخول لتفعيل التقرير.</p>}</div> : null}
    <p className="text-xs leading-6 text-slate-500">{report.disclaimer}</p>
  </>;
}

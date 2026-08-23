"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Copy,
  GraduationCap,
  LockKeyhole,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { egyptianGovernorates } from "@/lib/governorates";
import { normalizeDigits } from "@/lib/normalize-arabic";
import { formatEgp, getServerBasedNow, isOfferActive, type PublicOffer } from "@/lib/offer-config";
import { OfferCountdown } from "@/components/offer-countdown";
import { useTrackFunnel } from "@/components/analytics-tracker";
import { SignalIndicator } from "@/components/signal-indicator";
import { generateSmartLockedTeasers } from "@/lib/smart-locked-teasers";
import {
  DISCIPLINE_GROUPS,
  getDisciplineGroup,
  extractReportInsights,
  buildTansikBlueprint,
  type DisciplineId,
} from "@/lib/report-sectors";
import { ReportFiltersBar, type ReportFilterState } from "@/components/report-filters";
import { ReportInsightsSummary } from "@/components/report-insights-summary";
import { TansikBlueprintGuide } from "@/components/tansik-blueprint-guide";

type Branch = "science" | "mathematics" | "literary";
type System = "new" | "old";
type StudentResult = {
  year: number;
  seatNumber: string;
  studentName: string;
  educationSystem: System | "unknown";
  branch: Branch | "unknown";
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  resultStatus: string;
  governorate: string | null;
  schoolName: string | null;
};
type SearchMode = "seat" | "name";
type Recommendation = {
  id: string;
  officialNameArabic: string;
  category: "safe" | "target" | "reach" | "unlikely" | "insufficient_data";
  proximityLabel: string;
  requiresAptitudeTest: boolean;
};
type PaymentState =
  | { status: "unlocked"; paymentId?: string }
  | { status: "pending"; paymentId: string; hasReceipt: boolean }
  | { status: "rejected"; paymentId: string }
  | { status: "none" };
type LegacyPredictionResponse = {
  predictionId?: string;
  eligibility: { eligible: boolean };
  recommendations: Recommendation[];
  lockedRecommendationCount?: number;
  premium?: boolean;
  unlocked?: boolean;
  message?: string;
  requiresBranch?: boolean;
  paymentState?: PaymentState;
  branch?: Branch;
};
type V2Fit = "green" | "yellow" | "orange" | "red";
type V2ReportItem = {
  id: string;
  officialNameArabic: string;
  fit: V2Fit;
  fitLabel: "مناسب جدًا" | "فرصة جيدة" | "اختيار طموح" | "بعيد عن مجموعك";
  expectedRange: [number, number];
  predictedCutoffPercentage: number;
  proximityLabel: string;
  requiresAptitudeTest: boolean;
  limitedDataWarning: string | null;
  availability: "listed_stage_2" | "forecast_stage_3";
  availabilityLabel?: "متوقع يظهر في المرحلة الثالثة";
};
type V2PredictionResponse = {
  schemaVersion: "prediction-v2-report@1";
  predictionId?: string;
  eligibility: {
    eligible: boolean;
    status: "eligible_stage_2" | "below_stage_2_floor" | "availability_unknown";
    minimumScore: number;
    minimumPercentage: number;
    message: string;
  };
  groups: {
    closest: { items: V2ReportItem[]; hiddenCount: number };
    ambitious: { items: V2ReportItem[]; hiddenCount: number };
    stage3Forecast: { items: V2ReportItem[]; hiddenCount: number };
    higherThanScore: { items: V2ReportItem[]; hiddenCount: number; collapsed: true };
  };
  recommendations: V2ReportItem[];
  coverageWarning: { active: boolean; message: string };
  disclaimer: string;
  lockedRecommendationCount?: number;
  premium?: boolean;
  unlocked?: boolean;
  message?: string;
  requiresBranch?: boolean;
  paymentState?: PaymentState;
  branch?: Branch;
};
type Stage3PredictionResponse = {
  schemaVersion: "stage3-report@1";
  predictionId?: string;
  coordinationStage: 3;
  availabilityStatus: "official" | "official_list_unavailable_for_old_system";
  availabilityLabel: string;
  registration: { minimumScore: number; minimumPercentage: number; eligible: boolean };
  groups: {
    closest: { items: Stage3ReportItem[]; hiddenCount: number };
    ambitious: { items: Stage3ReportItem[]; hiddenCount: number };
    higherThanScore: { items: Stage3ReportItem[]; hiddenCount: number; collapsed: true };
    conditional: { items: Stage3ReportItem[]; hiddenCount: number };
  };
  recommendations: Stage3ReportItem[];
  conditionalRecommendations: Stage3ReportItem[];
  disclaimers: string[];
  lockedRecommendationCount: number;
  premium: boolean;
  paymentState?: PaymentState;
  requiresBranch?: boolean;
  branch?: Branch;
};
type Stage3ReportItem = Omit<V2ReportItem, "availability" | "availabilityLabel"> & {
  availability: "listed_stage_3";
  availabilityLabel: "متاح في المرحلة الثالثة";
  eligibilityCondition: string | null;
};
type PredictionResponse = LegacyPredictionResponse | V2PredictionResponse | Stage3PredictionResponse;
type PaymentSettings = {
  priceEgp: string;
  serverNow: string;
  receivedAt: number;
  offer: PublicOffer;
  products: {
    single: { id: "single"; label: string; priceEgp: string; originalPriceEgp: string; savingsEgp: string; seatCount: 1; offer: { badgeText: string; title: string; subtitle: string; ctaText: string; endAt: string | null; showCountdown: boolean } | null };
    friends3: {
      id: "friends_3";
      label: string;
      priceEgp: string;
      seatCount: 3;
      enabled: boolean;
      regularTotalEgp: string;
      savingsEgp: string;
      offer: { badgeText: string; title: string; subtitle: string; ctaText: string; endAt: string | null; showCountdown: boolean } | null;
    };
  };
  methods: Array<{
    id: string;
    label: string;
    recipient: string;
    deepLink?: string;
    logoSrc: string;
  }>;
  receiptRequired: boolean;
};
type ProductType = "single" | "friends_3";
type DiscountQuote = { code: string; originalAmount: number; discountAmount: number; finalAmount: number; discountType: "percentage" | "fixed"; discountValue: number };

const branchLabels: Record<Branch, string> = {
  science: "علمي علوم",
  mathematics: "علمي رياضة",
  literary: "أدبي",
};

function simpleProximity(label: string) {
  if (!label || label === "محافظة أخرى" || label === "other") return null;
  return label === "نطاق قريب استرشادي" ? "قريبة منك" : label;
}

function formatScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");
}

function normalizeReport(data: Record<string, unknown>): PredictionResponse {
  if (data.premium && data.report && typeof data.report === "object") {
    return {
      ...(data.report as PredictionResponse),
      predictionId: String(data.predictionId ?? ""),
      premium: true,
      unlocked: true,
      paymentState: data.paymentState as PaymentState | undefined,
      branch: data.branch as Branch | undefined,
    };
  }
  return data as PredictionResponse;
}

function isV2Report(report: PredictionResponse): report is V2PredictionResponse {
  return "schemaVersion" in report && report.schemaVersion === "prediction-v2-report@1";
}

function isStage3Report(report: PredictionResponse): report is Stage3PredictionResponse {
  return "schemaVersion" in report && report.schemaVersion === "stage3-report@1";
}

export function ToolExperience() {
  const [searchMode, setSearchMode] = useState<SearchMode>("seat");
  const [seatNumber, setSeatNumber] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<StudentResult[]>([]);
  const [selectedNameResult, setSelectedNameResult] = useState<StudentResult | null>(null);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [activeNameIndex, setActiveNameIndex] = useState(-1);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [branch, setBranch] = useState<Branch | "">("");
  const [governorate, setGovernorate] = useState("");
  const [report, setReport] = useState<PredictionResponse | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [requestedProduct, setRequestedProduct] = useState<ProductType>("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameSearchAbortRef = useRef<AbortController | null>(null);
  const trackFunnel = useTrackFunnel();

  async function findResult(value: string, method: SearchMode = "seat", signal?: AbortSignal) {
    const response = await fetch("/api/result-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026, method, query: value }),
      signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return (data.results ?? []) as StudentResult[];
  }

  function assertCompleteResult(found: StudentResult | undefined) {
    if (!found) throw new Error("راجع بيانات البحث وحاول تاني.");
    if (
      found.totalScore == null ||
      found.maxScore == null ||
      found.percentage == null ||
      found.educationSystem === "unknown"
    ) {
      throw new Error("النتيجة دي لسه مش مكتملة عندنا.");
    }
    return found;
  }

  useEffect(() => {
    if (searchMode !== "name" || selectedNameResult?.studentName === nameQuery.trim()) return;
    const usefulLength = nameQuery.replace(/[^\p{L}\p{N}]/gu, "").length;
    nameSearchAbortRef.current?.abort();
    setActiveNameIndex(-1);
    if (usefulLength < 3) {
      setNameResults([]);
      setNameMenuOpen(false);
      setNameSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    nameSearchAbortRef.current = controller;
    const timer = window.setTimeout(() => {
      setNameSearchLoading(true);
      setNameMenuOpen(true);
      void findResult(nameQuery.trim(), "name", controller.signal)
        .then((matches) => setNameResults(matches.slice(0, 8)))
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setNameResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setNameSearchLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [nameQuery, searchMode, selectedNameResult]);

  async function createReport(
    student: StudentResult,
    selectedBranch?: Branch,
    selectedGovernorate?: string,
  ) {
    const response = await fetch("/api/predictions/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: 2026,
        seatNumber: student.seatNumber,
        branch: selectedBranch || undefined,
        governorate: selectedGovernorate || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return normalizeReport(data);
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const found = searchMode === "seat"
        ? assertCompleteResult((await findResult(normalizeDigits(seatNumber)))[0])
        : assertCompleteResult(selectedNameResult ?? undefined);
      setResult(found);
      trackFunnel("search_result");
      setGovernorate(found.governorate ?? "");
      const knownBranch = found.branch === "unknown" ? undefined : found.branch;
      setBranch(knownBranch ?? "");
      const nextReport = await createReport(found, knownBranch, found.governorate ?? undefined);
      if (!nextReport.requiresBranch) {
        setReport(nextReport);
        trackFunnel("report_viewed", { source: searchMode === "name" ? "name_search" : "seat_search" });
        if (nextReport.branch) setBranch(nextReport.branch);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إظهار النتيجة.");
    } finally {
      setLoading(false);
    }
  }

  async function submitDetails(event: FormEvent) {
    event.preventDefault();
    if (!result || !branch) {
      setError("اختار شعبتك علشان نعرض الترشيح المناسب ليك.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setReport(await createReport(result, branch, governorate));
      trackFunnel("report_viewed", { source: "branch_selection" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تجهيز الترشيح.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!report || report.premium) return;
    void fetch("/api/payment-settings")
      .then(async (response) => {
        if (response.ok) setSettings({ ...(await response.json()), receivedAt: Date.now() });
      })
      .catch(() => undefined);
  }, [report]);

  useEffect(() => {
    const selectProduct = (event: Event) => {
      const product = (event as CustomEvent<ProductType>).detail;
      if (product === "single" || product === "friends_3") setRequestedProduct(product);
    };
    window.addEventListener("masarak-product-select", selectProduct);
    return () => window.removeEventListener("masarak-product-select", selectProduct);
  }, []);

  function resetJourney() {
    setResult(null);
    setReport(null);
    setBranch("");
    setGovernorate("");
    setSettings(null);
    setRequestedProduct("single");
    setError("");
  }

  function changeSearchMode(mode: SearchMode) {
    setSearchMode(mode);
    setError("");
    setNameMenuOpen(false);
  }

  function chooseName(match: StudentResult) {
    setSelectedNameResult(match);
    setNameQuery(match.studentName);
    setSeatNumber(match.seatNumber);
    setNameMenuOpen(false);
    setError("");
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!nameMenuOpen || nameResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveNameIndex((current) => (current + 1) % nameResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveNameIndex((current) => (current <= 0 ? nameResults.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeNameIndex >= 0) {
      event.preventDefault();
      chooseName(nameResults[activeNameIndex]);
    } else if (event.key === "Escape") {
      setNameMenuOpen(false);
    }
  }

  return (
    <div className="conversion-shell bg-white shadow-[0_6px_8px_rgba(15,42,61,.08)]">
      <div className="conversion-intro">
        <div>
          <span className="conversion-badge">
            <Sparkles size={15} aria-hidden="true" />
            <span>
              <b>السيستم اتحدّث</b>
              <small>شواغر المرحلة الثالثة منشورة رسميًا</small>
            </span>
          </span>
          <h2>اعرف أقرب كلياتك بالاسم أو رقم الجلوس</h2>
        </div>
        <ol className="journey-steps" aria-label="خطوات التقرير">
          <li className="is-current"><b>1</b><span>بياناتك</span></li>
          <li className={result ? "is-current" : ""}><b>2</b><span>الشعبة</span></li>
          <li className={report ? "is-current" : ""}><b>3</b><span>الترشيحات</span></li>
        </ol>
      </div>

      <div className="conversion-body">
        {!result ? (
          <form onSubmit={submitSearch} className="seat-form">
            <div className="search-mode-tabs" role="tablist" aria-label="طريقة البحث">
              <button type="button" role="tab" aria-selected={searchMode === "seat"} className={searchMode === "seat" ? "is-active" : ""} onClick={() => changeSearchMode("seat")}>رقم الجلوس</button>
              <button type="button" role="tab" aria-selected={searchMode === "name"} className={searchMode === "name" ? "is-active" : ""} onClick={() => changeSearchMode("name")}>الاسم</button>
            </div>
            <div className="seat-entry-row">
              <div className="name-search-area">
                <label htmlFor={searchMode === "seat" ? "seat-number" : "student-name"} className="sr-only">
                  {searchMode === "seat" ? "رقم الجلوس" : "اسم الطالب"}
                </label>
                <div className="seat-input-wrap">
                  <Search size={20} aria-hidden="true" />
                  {searchMode === "seat" ? (
                    <input
                      id="seat-number"
                      value={seatNumber}
                      onChange={(event) => setSeatNumber(event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="اكتب رقم جلوسك"
                      minLength={4}
                      maxLength={14}
                      required
                    />
                  ) : (
                    <input
                      id="student-name"
                      value={nameQuery}
                      onChange={(event) => {
                        setNameQuery(event.target.value);
                        setSelectedNameResult(null);
                      }}
                      onFocus={() => nameResults.length > 0 && setNameMenuOpen(true)}
                      onKeyDown={handleNameKeyDown}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={nameMenuOpen}
                      aria-controls="student-name-options"
                      aria-activedescendant={activeNameIndex >= 0 ? `student-name-option-${activeNameIndex}` : undefined}
                      autoComplete="off"
                      placeholder="اكتب 3 حروف أو أكتر من اسمك"
                      maxLength={120}
                      required
                    />
                  )}
                </div>
                {searchMode === "name" && nameMenuOpen ? (
                  <div className="name-search-menu" id="student-name-options" role="listbox">
                    {nameSearchLoading ? <p className="name-search-status">بندور على الاسم…</p> : null}
                    {!nameSearchLoading && nameResults.length === 0 ? <p className="name-search-status">ملقيناش اسم مطابق. جرّب تكتب اسم أكتر.</p> : null}
                    {!nameSearchLoading ? nameResults.map((match, index) => (
                      <button
                        id={`student-name-option-${index}`}
                        key={`${match.year}-${match.seatNumber}`}
                        type="button"
                        role="option"
                        aria-selected={activeNameIndex === index}
                        className={activeNameIndex === index ? "is-active" : ""}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseName(match)}
                      >
                        <span>{match.studentName}</span>
                        <small>
                          {[match.governorate, match.schoolName].filter(Boolean).join(" · ") || `المجموع ${formatScore(match.percentage)}%`}
                        </small>
                      </button>
                    )) : null}
                  </div>
                ) : null}
              </div>
              <button type="submit" className="conversion-primary" disabled={loading || (searchMode === "name" && !selectedNameResult)}>
                {loading ? "بندور على نتيجتك…" : "شوف أقرب كلياتك"}
                {!loading ? <ArrowLeft size={18} aria-hidden="true" /> : null}
              </button>
            </div>
            <p className="search-method-helper">
              {searchMode === "name"
                ? selectedNameResult ? `تم اختيار ${selectedNameResult.studentName}` : "اختار اسمك من النتائج علشان نستخدم رقم جلوسك تلقائيًا."
                : "رقم الجلوس هو أسرع طريقة للوصول لنتيجتك."}
            </p>
          </form>
        ) : !report ? (
          <form onSubmit={submitDetails} className="details-step">
            <div className="student-result-summary">
              <div className="student-avatar" aria-hidden="true">
                <GraduationCap size={24} />
              </div>
              <div>
                <span>لقينا نتيجتك</span>
                <h3>{result.studentName}</h3>
                <p>
                  <b className="ltr-number">{result.percentage}%</b>
                  <span aria-hidden="true"> · </span>
                  رقم الجلوس <b className="ltr-number">{result.seatNumber}</b>
                </p>
              </div>
              <button type="button" onClick={resetJourney}>تغيير البحث</button>
            </div>

            <fieldset className="branch-choice">
              <legend>اختار شعبتك</legend>
              <div>
                {(Object.entries(branchLabels) as Array<[Branch, string]>).map(
                  ([value, label]) => (
                    <label key={value} className={branch === value ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="branch"
                        value={value}
                        checked={branch === value}
                        onChange={() => setBranch(value)}
                      />
                      <span>{label}</span>
                      {branch === value ? <Check size={17} aria-hidden="true" /> : null}
                    </label>
                  ),
                )}
              </div>
            </fieldset>

            <label className="governorate-field">
              محافظتك <small>اختياري</small>
              <select value={governorate} onChange={(event) => setGovernorate(event.target.value)}>
                <option value="">اختار المحافظة</option>
                {egyptianGovernorates.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <button className="conversion-primary details-cta" disabled={loading || !branch}>
              {loading ? "بنجهّز ترشيحك…" : "اعرض أول ترشيح مجانًا"}
              {!loading ? <ArrowLeft size={18} aria-hidden="true" /> : null}
            </button>
          </form>
        ) : (
          <Report
            report={report}
            result={result}
            branch={branch as Branch}
            governorate={governorate}
            settings={settings}
            initialProduct={requestedProduct}
            onReset={resetJourney}
            onUnlocked={setReport}
          />
        )}

        {error ? <p role="alert" className="conversion-error">{error}</p> : null}
      </div>
    </div>
  );
}

function Report({
  report,
  result,
  branch,
  governorate,
  settings,
  initialProduct,
  onReset,
  onUnlocked,
}: {
  report: PredictionResponse;
  result: StudentResult;
  branch: Branch;
  governorate: string;
  settings: PaymentSettings | null;
  initialProduct: ProductType;
  onReset: () => void;
  onUnlocked: (report: PredictionResponse) => void;
}) {
  if (isStage3Report(report)) {
    return (
      <Stage3StudentReport
        report={report}
        result={result}
        settings={settings}
        initialProduct={initialProduct}
        onReset={onReset}
        onUnlocked={onUnlocked}
      />
    );
  }
  if (isV2Report(report)) {
    return (
      <PredictionV2StudentReport
        report={report}
        result={result}
        settings={settings}
        initialProduct={initialProduct}
        onReset={onReset}
        onUnlocked={onUnlocked}
      />
    );
  }
  const recommendations = report.premium
    ? report.recommendations
    : report.recommendations.slice(0, 1);

  if (!report.eligibility.eligible) {
    return (
      <div className="simple-result-state">
        <GraduationCap size={34} aria-hidden="true" />
        <h3>لسه قدامك اختيارات المرحلة الثالثة</h3>
        <p>هنحدّث الترشيحات أول ما تبدأ المرحلة الجديدة.</p>
        <button type="button" onClick={onReset}>جرّب رقم جلوس تاني</button>
      </div>
    );
  }

  if (!recommendations.length) {
    return (
      <div className="simple-result-state">
        <GraduationCap size={34} aria-hidden="true" />
        <h3>لسه بنحدّث الاختيارات المناسبة ليك</h3>
        <p>مش هنعرض ترشيح إلا لما تكون بياناته كافية.</p>
        <button type="button" onClick={onReset}>جرّب رقم جلوس تاني</button>
      </div>
    );
  }

  return (
    <div className="report-conversion" aria-live="polite">
      <div className="report-heading">
        <div>
          {report.premium ? <span className="premium-open-badge">التقرير الكامل مفتوح ✓</span> : <span>ترشيحك المجاني</span>}
          <h3>{report.premium ? "كل اختياراتك المناسبة" : "بداية مبشّرة ليك"}</h3>
        </div>
        <button type="button" onClick={onReset}>ابدأ من جديد</button>
      </div>

      <div className="report-student-summary" aria-label="بيانات نتيجتك">
        <div className="report-student-identity">
          <div className="report-student-avatar" aria-hidden="true">
            <GraduationCap size={22} />
          </div>
          <div>
            <span>نتيجتك</span>
            <strong title={result.studentName}>{result.studentName}</strong>
            <small>رقم الجلوس <bdi className="ltr-number">{result.seatNumber}</bdi></small>
          </div>
        </div>
        <div className="report-score-block">
          <span>المجموع</span>
          <strong><bdi className="ltr-number">{formatScore(result.totalScore)}</bdi></strong>
          <small>من <bdi className="ltr-number">{formatScore(result.maxScore)}</bdi></small>
        </div>
      </div>

      <div className={report.premium ? "full-recommendations" : ""}>
        {recommendations.map((item, index) => (
          <article key={item.id} className="free-recommendation">
            <div className="recommendation-number">{index + 1}</div>
            <div className="recommendation-copy">
              <SignalIndicator fit={item.category} />
              <h4>{item.officialNameArabic}</h4>
              {simpleProximity(item.proximityLabel) ? <p>{simpleProximity(item.proximityLabel)}</p> : null}
              {item.requiresAptitudeTest ? <small>محتاج اختبار قدرات</small> : null}
            </div>
            <GraduationCap size={30} aria-hidden="true" />
          </article>
        ))}
      </div>

      {!report.premium && report.lockedRecommendationCount ? (
        <section className="locked-recommendations" aria-label="تحليلات وترشيحات مقفولة">
          <SmartLockedTeaserCards
            result={result}
            report={report}
            isStage3Report={false}
          />
          <GuestPaymentOffer
            predictionId={report.predictionId ?? ""}
            seatNumber={result.seatNumber}
            settings={settings}
            initialProduct={initialProduct}
            paymentState={report.paymentState}
            onUnlocked={onUnlocked}
          />
        </section>
      ) : null}
    </div>
  );
}

function Stage3StudentReport({
  report,
  result,
  settings,
  initialProduct,
  onReset,
  onUnlocked,
}: {
  report: Stage3PredictionResponse;
  result: StudentResult;
  settings: PaymentSettings | null;
  initialProduct: ProductType;
  onReset: () => void;
  onUnlocked: (report: PredictionResponse) => void;
}) {
  const sections = [
    { key: "closest", title: "أقرب اختيارات المرحلة الثالثة لمجموعك", items: report.groups.closest.items },
    { key: "ambitious", title: "اختيارات طموحة", items: report.groups.ambitious.items },
    { key: "conditional", title: "اختيارات بشروط إضافية", items: report.groups.conditional.items },
  ];
  const hasItems = sections.some((section) => section.items.length) || report.groups.higherThanScore.items.length;

  return (
    <div className="report-conversion" aria-live="polite">
      <div className="report-heading">
        <div>
          {report.premium ? <span className="premium-open-badge">تقرير المرحلة الثالثة الكامل مفتوح ✓</span> : <span>تقرير المرحلة الثالثة المجاني</span>}
          <h3>اختيارات متاحة رسميًا ومرتبة حسب مجموعك</h3>
        </div>
        <button type="button" onClick={onReset}>ابدأ من جديد</button>
      </div>

      <div className="report-student-summary" aria-label="بيانات نتيجتك">
        <div className="report-student-identity">
          <div className="report-student-avatar" aria-hidden="true"><GraduationCap size={22} /></div>
          <div><span>نتيجتك</span><strong>{result.studentName}</strong><small>رقم الجلوس <bdi className="ltr-number">{result.seatNumber}</bdi></small></div>
        </div>
        <div className="report-score-block"><span>المجموع</span><strong><bdi className="ltr-number">{formatScore(result.totalScore)}</bdi></strong><small>من <bdi className="ltr-number">{formatScore(result.maxScore)}</bdi></small></div>
      </div>

      <div className="stage3-report-notice" role="note">
        <strong>{report.availabilityLabel}</strong>
        <p>الإتاحة مؤكدة من القائمة الرسمية؛ المتوقع فقط هو الحد النهائي وترتيب الملاءمة.</p>
      </div>

      {!report.registration.eligible ? (
        <div className="simple-result-state"><h3>مجموعك أقل من الحد الرسمي للتسجيل</h3><p>الحد الأدنى هو {report.registration.minimumScore} درجة ({report.registration.minimumPercentage}%).</p></div>
      ) : null}

      {hasItems ? sections.map((section) => section.items.length ? (
        <section key={section.key} className="v2-report-section">
          <h3>{section.title}</h3>
          <div className="full-recommendations">
            {section.items.map((item) => (
              <article key={item.id} className="free-recommendation">
                <div className="recommendation-copy">
                  <SignalIndicator fit={item.fit} />
                  <small className="font-bold text-teal-800">{item.availabilityLabel}</small>
                  <h4>{item.officialNameArabic}</h4>
                  <p>{item.fitLabel} · الحد المتوقع {item.expectedRange[0]}–{item.expectedRange[1]}%</p>
                  {simpleProximity(item.proximityLabel) ? <p>{simpleProximity(item.proximityLabel)}</p> : null}
                  {item.eligibilityCondition ? <small>{item.eligibilityCondition}</small> : null}
                </div>
                <GraduationCap size={30} aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>
      ) : null) : (
        <div className="simple-result-state"><h3>لا توجد اختيارات موثقة يمكن عرضها لهذا النظام</h3><p>{report.availabilityLabel}</p></div>
      )}

      {report.groups.higherThanScore.items.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-extrabold text-[#173a55]">اختيارات أعلى من مجموعك</summary>
          <div className="mt-3 full-recommendations">{report.groups.higherThanScore.items.map((item) => <article key={item.id} className="free-recommendation"><div className="recommendation-copy"><SignalIndicator fit={item.fit} /><h4>{item.officialNameArabic}</h4><p>{item.fitLabel}</p></div></article>)}</div>
        </details>
      ) : null}

      {!report.premium && report.lockedRecommendationCount ? (
        <section className="locked-recommendations">
          <SmartLockedTeaserCards result={result} report={report} isStage3Report />
          <GuestPaymentOffer predictionId={report.predictionId ?? ""} seatNumber={result.seatNumber} settings={settings} initialProduct={initialProduct} paymentState={report.paymentState} onUnlocked={onUnlocked} />
        </section>
      ) : null}

      <div className="v2-report-disclaimer">{report.disclaimers.map((item) => <p key={item}>{item}</p>)}</div>
    </div>
  );
}

function PredictionV2StudentReport({
  report,
  result,
  settings,
  initialProduct,
  onReset,
  onUnlocked,
}: {
  report: V2PredictionResponse;
  result: StudentResult;
  settings: PaymentSettings | null;
  initialProduct: ProductType;
  onReset: () => void;
  onUnlocked: (report: PredictionResponse) => void;
}) {
  const isStage3Report = !report.eligibility.eligible;
  const sections = isStage3Report
    ? [{ key: "stage3", title: "أقرب توقعات المرحلة الثالثة لمجموعك", items: report.groups.stage3Forecast.items }]
    : [
        { key: "closest", title: "أقرب اختيارات لمجموعك", items: report.groups.closest.items },
        { key: "ambitious", title: "اختيارات طموحة", items: report.groups.ambitious.items },
        { key: "higher", title: "اختيارات أعلى من مجموعك", items: report.groups.higherThanScore.items },
      ];
  const visibleCount = sections.reduce((count, section) => count + section.items.length, 0);

  const [filterState, setFilterState] = useState<ReportFilterState>({
    selectedSector: "all",
    proximityFilter: "all",
    searchQuery: "",
  });

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const availableSectors = useMemo(() => {
    const counts = new Map<DisciplineId, number>();
    for (const item of allItems) {
      const grp = getDisciplineGroup(item.officialNameArabic);
      counts.set(grp.id, (counts.get(grp.id) ?? 0) + 1);
    }
    return (Object.keys(DISCIPLINE_GROUPS) as Array<keyof typeof DISCIPLINE_GROUPS>)
      .map((key) => ({
        ...DISCIPLINE_GROUPS[key],
        count: counts.get(key) ?? 0,
      }))
      .filter((s) => s.count > 0);
  }, [allItems]);

  const localCount = useMemo(() => {
    return allItems.filter((item) => {
      return (
        item.proximityLabel === "في محافظتك" ||
        item.proximityLabel === "قريبة منك" ||
        (item.proximityLabel && item.proximityLabel !== "محافظة أخرى" && item.proximityLabel !== "other")
      );
    }).length;
  }, [allItems]);

  const insights = useMemo(() => {
    return extractReportInsights({
      items: allItems,
      studentName: result.studentName,
      score: result.totalScore,
      percentage: result.percentage,
      branch: result.branch !== "unknown" ? result.branch : report.branch,
      governorate: result.governorate,
      isForecast: isStage3Report,
    });
  }, [allItems, result.studentName, result.totalScore, result.percentage, result.branch, result.governorate, report.branch]);

  const blueprintStages = useMemo(() => {
    return buildTansikBlueprint(allItems);
  }, [allItems]);

  const filteredSections = useMemo(() => {
    if (!report.premium) return sections;
    return sections.map((section) => {
      const items = section.items.filter((item) => {
        if (filterState.selectedSector !== "all") {
          const grp = getDisciplineGroup(item.officialNameArabic);
          if (grp.id !== filterState.selectedSector) return false;
        }
        if (filterState.proximityFilter === "local_only") {
          const isLocal =
            item.proximityLabel === "في محافظتك" ||
            item.proximityLabel === "قريبة منك" ||
            (item.proximityLabel && item.proximityLabel !== "محافظة أخرى" && item.proximityLabel !== "other");
          if (!isLocal) return false;
        }
        if (filterState.searchQuery.trim()) {
          const query = filterState.searchQuery.trim().toLowerCase();
          if (!item.officialNameArabic.toLowerCase().includes(query)) return false;
        }
        return true;
      });
      return { ...section, items };
    });
  }, [sections, filterState, report.premium]);

  const totalFilteredCount = useMemo(
    () => filteredSections.reduce((count, section) => count + section.items.length, 0),
    [filteredSections],
  );

  if (!visibleCount) {
    return (
      <div className="simple-result-state">
        <GraduationCap size={34} aria-hidden="true" />
        <h3>مفيش بيانات كفاية لترشيح آمن دلوقتي</h3>
        <p>{report.coverageWarning.message}</p>
        <button type="button" onClick={onReset}>جرّب رقم جلوس تاني</button>
      </div>
    );
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="report-conversion" aria-live="polite">
      <div className="report-heading">
        <div>
          {report.premium
            ? <span className="premium-open-badge">التقرير الكامل مفتوح ✓</span>
            : <span>{isStage3Report ? "توقعك المجاني للمرحلة الثالثة" : "ترشيحك المجاني"}</span>}
          <h3>
            {isStage3Report
              ? report.premium ? "تقرير مناسب لمجموعك للمرحلة الثالثة" : "أقرب توقع لمجموعك"
              : report.premium ? "كل اختياراتك المناسبة" : "بداية مبشّرة ليك"}
          </h3>
        </div>
        <div className="report-heading-actions">
          {report.premium ? (
            <button type="button" className="report-print-quick-btn" onClick={handlePrint}>
              طباعة التقرير
            </button>
          ) : null}
          <button type="button" onClick={onReset}>ابدأ من جديد</button>
        </div>
      </div>

      <div className="report-student-summary" aria-label="بيانات نتيجتك">
        <div className="report-student-identity">
          <div className="report-student-avatar" aria-hidden="true"><GraduationCap size={22} /></div>
          <div>
            <span>نتيجتك</span>
            <strong title={result.studentName}>{result.studentName}</strong>
            <small>رقم الجلوس <bdi className="ltr-number">{result.seatNumber}</bdi></small>
          </div>
        </div>
        <div className="report-score-block">
          <span>المجموع</span>
          <strong><bdi className="ltr-number">{formatScore(result.totalScore)}</bdi></strong>
          <small>من <bdi className="ltr-number">{formatScore(result.maxScore)}</bdi></small>
        </div>
      </div>

      {isStage3Report ? (
        <div className="stage3-report-notice" role="note">
          <strong>ده تقرير مرحلة ثانية محفوظ كما صدر وقتها</strong>
          <p>قد تكون حالة الإتاحة اتغيّرت بعد إعلان شواغر المرحلة الثالثة؛ استخدم تقرير المرحلة الثالثة الجديد للحالة الحالية.</p>
        </div>
      ) : null}

      {report.premium ? (
        <>
          <ReportInsightsSummary
            insights={insights}
            studentName={result.studentName}
            score={result.totalScore}
            governorate={result.governorate}
            isStage3Report={isStage3Report}
          />
          <ReportFiltersBar
            filterState={filterState}
            onFilterChange={setFilterState}
            availableSectors={availableSectors}
            totalCount={allItems.length}
            localCount={localCount}
          />
        </>
      ) : null}

      <div className="v2-report-sections">
        {report.premium && totalFilteredCount === 0 ? (
          <div className="report-empty-filter-state">
            <p>لا توجد كليات مطابقة للفلاتر المحددة</p>
            <button
              type="button"
              onClick={() => setFilterState({ selectedSector: "all", proximityFilter: "all", searchQuery: "" })}
            >
              عرض كل الكليات
            </button>
          </div>
        ) : (
          filteredSections.map((section) => section.items.length ? (
            <section key={section.key} className="v2-report-section" aria-labelledby={`section-${section.key}`}>
              <h4 id={`section-${section.key}`}>{section.title}</h4>
              <div className="v2-recommendation-grid">
                {section.items.map((item, index) => (
                  <article key={item.id} className={`free-recommendation v2-recommendation fit-${item.fit}`}>
                    <div className="recommendation-number">{index + 1}</div>
                    <div className="recommendation-copy">
                      <SignalIndicator fit={item.fit} />
                      <h4>{item.officialNameArabic}</h4>
                      <p>
                        {item.availability === "forecast_stage_3" ? "توقع محفوظ من وقت المرحلة الثانية · " : "كان متاحًا في قائمة المرحلة الثانية · "}
                        نطاق متوقع <bdi className="ltr-number">{item.expectedRange[0]}%–{item.expectedRange[1]}%</bdi>
                      </p>
                      {simpleProximity(item.proximityLabel) ? <small>{simpleProximity(item.proximityLabel)}</small> : null}
                      {item.requiresAptitudeTest ? <small className="recommendation-warning">يتطلب اجتياز اختبار قدرات</small> : null}
                      {item.limitedDataWarning ? <small className="recommendation-warning">{item.limitedDataWarning}</small> : null}
                    </div>
                    <GraduationCap size={28} aria-hidden="true" />
                  </article>
                ))}
              </div>
            </section>
          ) : null)
        )}
      </div>

      {report.premium && !isStage3Report ? (
        <TansikBlueprintGuide stages={blueprintStages} onPrint={handlePrint} />
      ) : null}

      {!report.premium && report.lockedRecommendationCount ? (
        <section className="locked-recommendations" aria-label="تحليلات وترشيحات مقفولة">
          <SmartLockedTeaserCards
            result={result}
            report={report}
            isStage3Report={isStage3Report}
          />
          <GuestPaymentOffer
            predictionId={report.predictionId ?? ""}
            seatNumber={result.seatNumber}
            settings={settings}
            initialProduct={initialProduct}
            paymentState={report.paymentState}
            onUnlocked={onUnlocked}
          />
        </section>
      ) : null}

      <p className="v2-report-disclaimer">{report.disclaimer}</p>
    </div>
  );
}

function SmartLockedTeaserCards({
  result,
  report,
  isStage3Report,
}: {
  result: StudentResult;
  report: PredictionResponse;
  isStage3Report: boolean;
}) {
  const teasers = generateSmartLockedTeasers({
    branch: result.branch !== "unknown" ? result.branch : report.branch,
    score: result.totalScore,
    percentage: result.percentage,
    governorate: result.governorate,
    isStage3: isStage3Report,
  });

  return (
    <div className="smart-locked-container">
      <div className="smart-locked-header">
        <div className="smart-locked-badge-pill">
          <Sparkles size={14} aria-hidden="true" />
          <span>تحليلات ذكية مقفولة لنتيجتك</span>
        </div>
        <div className="smart-locked-title-wrap">
          <h4>
            {result.studentName
              ? `أهم التساؤلات والتحليلات لنتيجة ${result.studentName}`
              : `أهم التساؤلات والتحليلات لمجموع ${formatScore(result.totalScore)}`}
          </h4>
          <p>إجابات حاسمة ومحسوبة بالدرجات لأهم الأسئلة اللي بتدور في بالك دلوقتي</p>
        </div>
      </div>

      <div className="smart-locked-grid">
        {teasers.map((teaser) => (
          <article key={teaser.id} className="smart-locked-card">
            <div className="smart-locked-card-header">
              <span className="smart-locked-tag">{teaser.categoryTag}</span>
              <span className="smart-locked-lock-badge">
                <LockKeyhole size={13} aria-hidden="true" />
                <span>متاح في التقرير</span>
              </span>
            </div>
            <p className="smart-locked-question">{teaser.question}</p>
            <div className="smart-locked-card-footer">
              <span className="smart-locked-blur-preview" aria-hidden="true" />
              <small>عرض التحليل والفرصة المؤكدة بعد فتح التقرير</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function GuestPaymentOffer({
  predictionId,
  seatNumber,
  settings,
  initialProduct,
  paymentState,
  onUnlocked,
}: {
  predictionId: string;
  seatNumber: string;
  settings: PaymentSettings | null;
  initialProduct: ProductType;
  paymentState?: PaymentState;
  onUnlocked: (report: PredictionResponse) => void;
}) {
  const [productType, setProductType] = useState<ProductType>(initialProduct);
  const [friendSeats, setFriendSeats] = useState<[string, string]>(["", ""]);
  const [seatError, setSeatError] = useState("");
  const [method, setMethod] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discountQuote, setDiscountQuote] = useState<DiscountQuote | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState(paymentState?.status === "pending" ? paymentState.paymentId : "");
  const [mode, setMode] = useState<"form" | "submitting" | "pending" | "rejected">(
    paymentState?.status === "pending" && paymentState.hasReceipt ? "pending" : paymentState?.status === "rejected" ? "rejected" : "form",
  );
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(paymentState?.status === "pending" && paymentState.hasReceipt);
  const trackFunnel = useTrackFunnel();
  const [now, setNow] = useState(() => Date.now());
  const pollingRef = useRef(false);
  const copyResetRef = useRef<number | null>(null);
  const offerTrackedRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
  }, []);

  useEffect(() => {
    setProductType(initialProduct);
  }, [initialProduct]);

  useEffect(() => {
    setDiscountQuote(null);
    setDiscountError("");
  }, [productType]);

  useEffect(() => {
    if (offerTrackedRef.current === predictionId) return;
    offerTrackedRef.current = predictionId;
    trackFunnel("offer_viewed", { product: initialProduct, source: "locked_report" });
  }, [initialProduct, predictionId, trackFunnel]);

  useEffect(() => {
    if (!settings?.methods.length) return;
    setMethod((current) => current || settings.methods[0].id);
  }, [settings]);

  const selectedProduct = productType === "friends_3"
    ? settings?.products.friends3
    : settings?.products.single;
  const activeOffer = settings ? isOfferActive(settings.offer, getServerBasedNow(settings.serverNow, settings.receivedAt, now)) && settings.offer.showInLockedOffer : false;
  const selectedOffer = activeOffer && settings?.offer.targetProduct === productType ? settings.offer : null;

  useEffect(() => {
    if (!settings?.offer.endAt || !settings.offer.showCountdown || !activeOffer) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeOffer, settings?.offer.endAt, settings?.offer.showCountdown]);



  useEffect(() => {
    if (!polling || pollingRef.current) return;
    pollingRef.current = true;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(`/api/payments/status?year=2026&seatNumber=${encodeURIComponent(seatNumber)}`, { cache: "no-store" });
        if (!response.ok) return;
        const state = await response.json() as PaymentState;
        if (cancelled) return;
        if (state.status === "unlocked") {
          const reportResponse = await fetch(`/api/predictions/${predictionId}/report`, { cache: "no-store" });
          const reportData = await reportResponse.json();
          if (reportResponse.ok && reportData.premium) {
            setPolling(false);
            setMode("form");
            onUnlocked(normalizeReport(reportData));
          }
        } else if (state.status === "rejected") {
          setPolling(false);
          setMode("rejected");
        }
      } catch {
        // The next poll retries without exposing a client-side authorization state.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    return () => {
      cancelled = true;
      pollingRef.current = false;
      window.clearInterval(timer);
    };
  }, [onUnlocked, paymentId, polling, predictionId, seatNumber]);

  async function copyRecipient(methodId: string, recipient: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(recipient);
      } else {
        const helper = document.createElement("textarea");
        helper.value = recipient;
        helper.setAttribute("readonly", "true");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      setCopiedMethod(methodId);
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopiedMethod(null), 1800);
    } catch {
      setError("تعذر نسخ الرقم. اضغط مطولًا على الرقم لنسخه.");
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isFreeWithCode = discountQuote?.finalAmount === 0;
    if (!settings || !selectedProduct || (!isFreeWithCode && !method) || (!isFreeWithCode && settings.receiptRequired && !receipt)) {
      setError(settings?.receiptRequired ? "اختار طريقة الدفع وارفع صورة الإيصال." : "اختار طريقة الدفع.");
      return;
    }
    const normalizedFriends = friendSeats.map((seat) => normalizeDigits(seat.trim()));
    const seatNumbers = productType === "friends_3"
      ? [seatNumber, ...normalizedFriends]
      : [seatNumber];
    if (productType === "friends_3") {
      if (normalizedFriends.some((seat) => !/^\d{4,14}$/.test(seat))) {
        setSeatError("اكتب رقم جلوس صحيح لكل صاحب.");
        return;
      }
      if (new Set(seatNumbers).size !== seatNumbers.length) {
        setSeatError("كل رقم جلوس لازم يكون مختلف.");
        return;
      }
    }
    setMode("submitting");
    trackFunnel("payment_started", { product: productType, source: "locked_report" });
    setError("");
    setSeatError("");
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictionId,
          year: 2026,
          productType,
          seatNumbers,
          method: method || "vodafone_cash",
          idempotencyKey: crypto.randomUUID(),
          discountCode: discountQuote?.code,
        }),
      });
      const data = await response.json();
      if (!response.ok && data.code === "ALREADY_UNLOCKED") {
        const full = await fetch(`/api/predictions/${predictionId}/report`, { cache: "no-store" });
        const fullData = await full.json();
        if (full.ok && fullData.premium) onUnlocked(normalizeReport(fullData));
        return;
      }
      if (!response.ok && data.code === "SEAT_ALREADY_UNLOCKED") {
        setSeatError(`الرقم ${data.unlockedSeats?.[0] ?? "ده"} مفتوح بالفعل. اكتب رقمًا آخر.`);
        throw new Error("SEAT_ALREADY_UNLOCKED");
      }
      if (!response.ok) throw new Error(data.error);
      const id = String(data.payment.id);
      setPaymentId(id);
      if (data.payment.status === "approved") {
        const full = await fetch(`/api/predictions/${predictionId}/report`, { cache: "no-store" });
        const fullData = await full.json();
        if (!full.ok || !fullData.premium) throw new Error(fullData.error ?? "تم قبول الطلب، لكن تعذر فتح التقرير الآن. حدّث الصفحة.");
        trackFunnel("payment_submitted", { product: productType, source: "locked_report" });
        onUnlocked(normalizeReport(fullData));
        return;
      }
      if (data.payment.hasReceipt) {
        trackFunnel("payment_submitted", { product: productType, source: "locked_report" });
        setMode("pending");
        setPolling(true);
        return;
      }
      if (!receipt) {
        setMode("pending");
        setPolling(true);
        return;
      }
      const form = new FormData();
      form.set("seatNumber", seatNumber);
      form.set("receipt", receipt);
      const upload = await fetch(`/api/payments/${id}/receipt`, { method: "POST", body: form });
      const uploadData = await upload.json();
      if (!upload.ok) throw new Error(uploadData.error);
      trackFunnel("payment_submitted", { product: productType, source: "locked_report" });
      setMode("pending");
      setPolling(true);
    } catch (caught) {
      setMode("form");
      if (!(caught instanceof Error && caught.message === "SEAT_ALREADY_UNLOCKED")) {
        setError(caught instanceof Error ? caught.message : "تعذر إرسال الدفع.");
      }
    }
  }

  async function applyDiscount() {
    setDiscountLoading(true); setDiscountError(""); setDiscountQuote(null);
    try {
      const response = await fetch("/api/discounts/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: discountCode, productType }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDiscountCode(data.quote.code);
      setDiscountQuote(data.quote);
    } catch (caught) { setDiscountError(caught instanceof Error ? caught.message : "تعذر تطبيق الكود."); }
    finally { setDiscountLoading(false); }
  }

  if (!settings) {
    return <div className="unlock-offer offer-loading">جارٍ تجهيز طرق الدفع…</div>;
  }

  if (mode === "pending") {
    return (
      <div className="payment-pending-state">
        <Check size={22} aria-hidden="true" />
        <div>
          <strong>تم استلام التحويل</strong>
          <span>جاري مراجعة الدفع — هنفتح التقرير تلقائيًا بعد الموافقة.</span>
        </div>
      </div>
    );
  }

  return (
    <form className="unlock-offer guest-payment-offer" onSubmit={submitPayment}>
      <div className="offer-action" id={`locked-report-options-${predictionId}`}>
        <div className="offer-product-picker" role="radiogroup" aria-label="اختار العرض">
          <button type="button" className={`offer-product-card${productType === "single" ? " is-selected" : ""}${selectedOffer?.targetProduct === "single" ? " has-offer" : ""}`} onClick={() => { setProductType("single"); trackFunnel("product_selected", { product: "single", source: "locked_report" }); }} aria-pressed={productType === "single"}>
            {productType === "single" ? <span className="offer-selected-badge"><Check size={12} aria-hidden="true" /> محدد الآن</span> : null}
            {selectedOffer?.targetProduct === "single" ? <span className="offer-product-badge"><Sparkles size={11} aria-hidden="true" />{selectedOffer.badgeText}</span> : null}
            <span className="offer-product-kicker">تقريرك</span>
            <strong><bdi>{settings.products.single.priceEgp}</bdi> <small>جنيه فقط</small></strong>
            <small>تقرير كامل لرقم جلوس واحد</small>
            {selectedOffer?.targetProduct === "single" ? <small className="offer-original-price">بدل <s><bdi>{formatEgp(settings.products.single.originalPriceEgp)}</bdi></s> جنيه · وفر {formatEgp(settings.products.single.savingsEgp)} جنيه</small> : null}
            {selectedOffer?.targetProduct === "single" ? <small className="offer-product-saving">{selectedOffer.subtitle}</small> : null}
            {selectedOffer?.targetProduct === "single" && selectedOffer.showCountdown ? <OfferCountdown endAt={selectedOffer.endAt} serverNow={settings.serverNow} receivedAt={settings.receivedAt} className="offer-countdown" /> : null}
          </button>
          {settings.products.friends3.enabled ? (
            <button type="button" className={`offer-product-card offer-product-card-featured${productType === "friends_3" ? " is-selected" : ""}${selectedOffer?.targetProduct === "friends_3" ? " has-offer" : ""}`} onClick={() => { setProductType("friends_3"); trackFunnel("product_selected", { product: "friends_3", source: "locked_report" }); }} aria-pressed={productType === "friends_3"}>
              {productType === "friends_3" ? <span className="offer-selected-badge"><Check size={12} aria-hidden="true" /> محدد الآن</span> : null}
              <span className="offer-product-badge">الأوفر 🔥</span>
              <span className="offer-product-kicker">إنت و2 من صحابك</span>
              <strong><bdi>{settings.products.friends3.priceEgp}</bdi> جنيه</strong>
              <small>3 تقارير كاملة · بدل {settings.products.friends3.regularTotalEgp} جنيه</small>
              <small className="offer-product-saving">وفر {settings.products.friends3.savingsEgp} جنيه</small>
              {selectedOffer?.targetProduct === "friends_3" && selectedOffer.showCountdown ? <OfferCountdown endAt={selectedOffer.endAt} serverNow={settings.serverNow} receivedAt={settings.receivedAt} className="offer-countdown" /> : null}
            </button>
          ) : null}
        </div>
        {productType === "friends_3" ? (
          <div className="friends-seat-fields">
            <label><span>أنت</span><input value={seatNumber} readOnly aria-label="رقم جلوسك" /></label>
            <label><span>صاحبك الأول</span><input value={friendSeats[0]} onChange={(event) => setFriendSeats([event.target.value, friendSeats[1]])} inputMode="numeric" placeholder="رقم الجلوس" required /></label>
            <label><span>صاحبك التاني</span><input value={friendSeats[1]} onChange={(event) => setFriendSeats([friendSeats[0], event.target.value])} inputMode="numeric" placeholder="رقم الجلوس" required /></label>
            <small>كل واحد يختار شعبته بعد ما يبحث برقم جلوسه.</small>
          </div>
        ) : null}
        <div className="discount-entry">
          <label htmlFor={`discount-${predictionId}`}>معاك كود خصم؟</label>
          <div><input id={`discount-${predictionId}`} value={discountCode} onChange={(event) => { setDiscountCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)); setDiscountQuote(null); setDiscountError(""); }} placeholder="AB12" maxLength={4} dir="ltr" />
          <button type="button" onClick={() => void applyDiscount()} disabled={discountLoading || discountCode.length !== 4}>{discountLoading ? "بنتحقق…" : "تطبيق"}</button></div>
          {discountQuote ? <p className="discount-success">تم تطبيق الكود — وفّرت {formatEgp(discountQuote.discountAmount)} جنيه</p> : null}
          {discountError ? <p className="payment-inline-error" role="alert">{discountError}</p> : null}
        </div>
        <div className={`offer-price-line${discountQuote ? " has-discount" : ""}`}><span>{discountQuote ? "المطلوب بعد الخصم" : "السعر"}</span><strong>{discountQuote ? <s><bdi>{formatEgp(discountQuote.originalAmount)}</bdi></s> : null} <bdi>{formatEgp(discountQuote?.finalAmount ?? selectedProduct?.priceEgp ?? 0)}</bdi> جنيه</strong></div>
        {seatError ? <p className="payment-inline-error" role="alert">{seatError}</p> : null}
        {discountQuote?.finalAmount === 0 ? <div className="discount-free-note"><Check size={18}/><span><strong>الكود فتح التقرير مجانًا</strong><small>اضغط الزر تحت ومش محتاج تحويل أو إيصال.</small></span></div> : <><div className="payment-method-grid" role="radiogroup" aria-label="طرق الدفع">
          {settings.methods.map((item) => {
            const inputId = `payment-method-${item.id}`;
            const isSelected = method === item.id;
            const isCopied = copiedMethod === item.id;
            return (
              <div key={item.id} className={`payment-method-option${isSelected ? " is-selected" : ""}`}>
                <input id={inputId} type="radio" name="payment-method" value={item.id} checked={isSelected} onChange={() => setMethod(item.id)} />
                <label htmlFor={inputId} className="payment-method-select">
                  <span className="payment-method-heading">
                    <span className="payment-logo-tile">
                      <Image src={item.logoSrc} alt={`${item.label} logo`} width={32} height={32} sizes="32px" />
                    </span>
                    <span className="payment-method-name">{item.label}</span>
                  </span>
                </label>
                <div className="payment-recipient-row">
                  <bdi>{item.recipient}</bdi>
                  <button
                    type="button"
                    className="payment-copy-button"
                    onClick={() => void copyRecipient(item.id, item.recipient)}
                    aria-label={`${isCopied ? "تم نسخ" : "نسخ"} رقم ${item.label}`}
                  >
                    {isCopied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    <span>{isCopied ? "تم النسخ" : "نسخ"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <label className="receipt-picker"><Upload size={17} /><span>{receipt ? receipt.name : settings.receiptRequired ? "ارفع صورة الإيصال — حتى 5MB" : "صورة الإيصال — اختيارية"}</span><input type="file" accept="image/jpeg,image/png,image/webp" required={settings.receiptRequired} onChange={(event) => { const file = event.target.files?.[0] ?? null; setReceipt(file); if (file) trackFunnel("receipt_uploaded", { product: productType, source: "locked_report" }); }} /></label></>}
        {mode === "rejected" ? <p className="payment-rejected">لم تتم الموافقة على الطلب السابق. يمكنك إرسال إيصال جديد.</p> : null}
        {error ? <p className="payment-inline-error" role="alert">{error}</p> : null}
        <button className="offer-cta" disabled={mode === "submitting"}>
          {mode === "submitting" ? (discountQuote?.finalAmount === 0 ? "جارٍ فتح التقرير…" : "جارٍ إرسال الإيصال…") : discountQuote?.finalAmount === 0 ? "افتح التقرير مجانًا" : selectedOffer?.ctaText ?? (productType === "friends_3" ? "ادفع وافتح التقارير" : "افتح تقريري")}
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

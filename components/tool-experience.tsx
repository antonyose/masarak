"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  GraduationCap,
  Globe2,
  HeartHandshake,
  Info,
  Instagram,
  LockKeyhole,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  getMaxScore,
  percentageToScore,
  scoreToPercentage,
  type Branch,
  type EducationSystem,
} from "@/lib/grade-scales";
import {
  egyptianGovernorates,
  isEgyptianGovernorate,
} from "@/lib/governorates";
import { normalizeDigits, usefulCharacterCount } from "@/lib/normalize-arabic";
import type {
  FacultyPrediction,
  PredictionCategory,
} from "@/lib/prediction";
import { selectRecommendedFaculties } from "@/lib/prediction";

type ActiveTool = "predict" | "search";
type InputMethod = "score" | "percentage";
type SearchMethod = "seat" | "name";
const COORDINATION_YEAR = 2026;

type StudentResult = {
  year: number;
  seatNumber: string;
  studentName: string;
  educationSystem: EducationSystem | "unknown";
  branch: Branch | "unknown";
  branchLabel: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  nationalRank: number | null;
  nationalTotalStudents: number | null;
  resultStatus: string;
  schoolName?: string;
  governorate?: string;
};

type PredictionResponse = {
  score: number;
  percentage: number;
  maxScore: number;
  estimatedRank: number;
  studentsAboveScore: number;
  confidence: string;
  predictions: FacultyPrediction[];
  dataMode: "preview" | "live";
  branchFallback?: boolean;
  governorate: string | null;
};

type ProximityScope = "nearby" | "all";

const systemLabels: Record<EducationSystem | "unknown", string> = {
  new: "النظام الجديد",
  old: "النظام القديم",
  unknown: "غير متاح",
};

const categoryLabels: Record<PredictionCategory, string> = {
  safe: "متوقع بدرجة كبيرة",
  target: "متوقع لمجموعك",
  reach: "ممكن لو الحد نزل",
  unlikely: "بعيد عن مجموعك",
  insufficient_data: "بياناتها غير كافية",
};

const categoryClass: Record<PredictionCategory, string> = {
  safe: "category-safe",
  target: "category-target",
  reach: "category-reach",
  unlikely: "category-unlikely",
  insufficient_data: "category-unlikely",
};

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: digits,
  }).format(value);
}

function resultCountLabel(count: number) {
  if (count === 1) return "تم العثور على النتيجة";
  if (count === 2) return "تم العثور على نتيجتين";
  const finalTwoDigits = count % 100;
  if (finalTwoDigits >= 3 && finalTwoDigits <= 10) {
    return `تم العثور على ${formatNumber(count)} نتائج`;
  }
  return `تم العثور على ${formatNumber(count)} نتيجة`;
}

function LoadingState() {
  return (
    <div className="results-area" aria-live="polite" aria-busy="true">
      <span className="sr-only">جارٍ تحميل النتائج</span>
      <div className="skeleton" style={{ height: 70 }} />
      <div
        className="skeleton"
        style={{ height: 128, marginTop: "0.75rem" }}
      />
    </div>
  );
}

export function ToolExperience({
  initialTool = "predict",
}: {
  initialTool?: ActiveTool;
}) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(initialTool);
  const year = COORDINATION_YEAR;
  const [system, setSystem] = useState<EducationSystem>("new");
  const [branch, setBranch] = useState<Branch | "">("science");
  const [governorate, setGovernorate] = useState("");
  const [inputMethod, setInputMethod] = useState<InputMethod>("score");
  const [score, setScore] = useState("288");
  const [percentage, setPercentage] = useState("90");
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [predictionError, setPredictionError] = useState("");
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | PredictionCategory>(
    "all",
  );
  const [proximityScope, setProximityScope] =
    useState<ProximityScope>("all");

  const [searchMethod, setSearchMethod] = useState<SearchMethod>("seat");
  const searchYear = COORDINATION_YEAR;
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searchDataMode, setSearchDataMode] = useState<"preview" | "live">(
    "preview",
  );
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const maxScore = getMaxScore(year, system) ?? (system === "new" ? 320 : 410);

  const displayedPredictions = useMemo(() => {
    if (!prediction) return [];
    return prediction.predictions.filter((faculty) => {
      const matchesCategory =
        categoryFilter === "all" || faculty.category === categoryFilter;
      const matchesLikelihood =
        categoryFilter === "unlikely" || faculty.category !== "unlikely";
      const matchesScope =
        proximityScope === "all" ||
        faculty.proximityTier === "same" ||
        faculty.proximityTier === "nearby";
      return matchesCategory && matchesLikelihood && matchesScope;
    });
  }, [prediction, categoryFilter, proximityScope]);

  function chooseSystem(nextSystem: EducationSystem) {
    const nextMax = getMaxScore(year, nextSystem);
    if (!nextMax) return;
    setSystem(nextSystem);
    const currentPercentage = Number.parseFloat(percentage);
    if (Number.isFinite(currentPercentage)) {
      setScore(
        percentageToScore(currentPercentage, nextMax)
          .toFixed(1)
          .replace(/\.0$/, ""),
      );
    }
  }

  function updateScore(raw: string) {
    const normalized = normalizeDigits(raw).replace(/[^\d.]/g, "");
    setScore(normalized);
    const numeric = Number.parseFloat(normalized);
    if (Number.isFinite(numeric) && numeric <= maxScore) {
      setPercentage(scoreToPercentage(numeric, maxScore).toFixed(2));
      setPredictionError("");
    }
  }

  function updatePercentage(raw: string) {
    const normalized = normalizeDigits(raw).replace(/[^\d.]/g, "");
    setPercentage(normalized);
    const numeric = Number.parseFloat(normalized);
    if (Number.isFinite(numeric) && numeric <= 100) {
      setScore(
        percentageToScore(numeric, maxScore).toFixed(1).replace(/\.0$/, ""),
      );
      setPredictionError("");
    }
  }

  async function submitPrediction(event: FormEvent) {
    event.preventDefault();
    const numericScore = Number.parseFloat(score);
    const numericPercentage = Number.parseFloat(percentage);
    if (
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > maxScore
    ) {
      setPredictionError(`أدخل مجموعًا صحيحًا من 0 إلى ${maxScore}.`);
      return;
    }
    if (!branch) {
      setPredictionError("اختر الشعبة أولًا حتى نعرض كليات مناسبة.");
      return;
    }
    if (
      !Number.isFinite(numericPercentage) ||
      numericPercentage < 0 ||
      numericPercentage > 100
    ) {
      setPredictionError("أدخل نسبة صحيحة من 0 إلى 100.");
      return;
    }

    setPredictionLoading(true);
    setPredictionError("");
    setPrediction(null);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          educationSystem: system,
          branch,
          score: numericScore,
          percentage: numericPercentage,
          governorate: governorate || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPrediction(data);
      setProximityScope(governorate ? "nearby" : "all");
      setCategoryFilter("all");
    } catch (error) {
      setPredictionError(
        error instanceof Error
          ? error.message
          : "تعذر حساب التوقع. حاول مرة أخرى.",
      );
    } finally {
      setPredictionLoading(false);
    }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (searchMethod === "seat" && normalizeDigits(query).length < 4) {
      setSearchError("أدخل رقم الجلوس كاملًا.");
      return;
    }
    if (searchMethod === "name" && usefulCharacterCount(query) < 4) {
      setSearchError("اكتب أربعة أحرف مفيدة على الأقل لتضييق النتائج.");
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setSearchMessage("");
    setSearchResults([]);
    setSearchTotalCount(0);
    try {
      const response = await fetch("/api/result-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: searchYear,
          method: searchMethod,
          query,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSearchResults(data.results);
      setSearchDataMode(data.dataMode);
      setSearchTotalCount(data.totalCount ?? data.results.length);
      setSearchMessage(data.message ?? "");
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "تعذر إتمام البحث. حاول مرة أخرى.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function transferResult(result: StudentResult) {
    if (
      result.totalScore === null ||
      result.percentage === null ||
      result.maxScore === null ||
      result.educationSystem === "unknown"
    ) {
      setSearchError(
        "لا يمكن نقل هذه النتيجة إلى التوقع قبل تأكيد نظام الدراسة والنهاية العظمى.",
      );
      return;
    }
    setSystem(result.educationSystem);
    setBranch(result.branch === "unknown" ? "" : result.branch);
    setGovernorate(
      result.governorate && isEgyptianGovernorate(result.governorate)
        ? result.governorate
        : "",
    );
    setScore(String(result.totalScore));
    setPercentage(String(result.percentage));
    setInputMethod("score");
    setPrediction(null);
    setPredictionError("");
    setActiveTool("predict");
    window.requestAnimationFrame(() => {
      document.getElementById("tool-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <>
      <div className="tool-switcher" role="tablist" aria-label="اختر الأداة">
        <button
          className="tool-tab"
          type="button"
          role="tab"
          aria-selected={activeTool === "predict"}
          aria-controls="tool-panel"
          onClick={() => setActiveTool("predict")}
        >
          <GraduationCap size={20} aria-hidden="true" />
          اعرف الكليات المتوقعة
        </button>
        <button
          className="tool-tab"
          type="button"
          role="tab"
          aria-selected={activeTool === "search"}
          aria-controls="tool-panel"
          onClick={() => setActiveTool("search")}
        >
          <Search size={19} aria-hidden="true" />
          اعرف نتيجتك
        </button>
      </div>

      <div className="tool-panel" id="tool-panel">
        <section className="tool-main" role="tabpanel">
          {activeTool === "predict" ? (
            <>
              <div className="tool-heading">
                <div>
                  <h2>أدخل مجموعك واستكشف أقرب الكليات</h2>
                  <p>
                    نُحوّل مجموعك إلى نسبة وترتيب تقديري قابل للمقارنة بين
                    السنوات المختلفة.
                  </p>
                </div>
                <span className="status-tag">
                  <Sparkles size={13} aria-hidden="true" />
                  توقع مبدئي 2026
                </span>
              </div>

              <form className="form-grid" onSubmit={submitPrediction} noValidate>
                <div className="field">
                  <span className="field-label">سنة التنسيق</span>
                  <div className="fixed-value" aria-label="سنة التنسيق 2026">
                    <strong className="ltr-number">2026</strong>
                    <span>السنة الحالية</span>
                  </div>
                </div>



                <div className="field field-full">
                  <label htmlFor="prediction-branch">الشعبة</label>
                  <select
                    id="prediction-branch"
                    value={branch}
                    onChange={(event) =>
                      setBranch(event.target.value as Branch)
                    }
                  >
                    <option value="" disabled>
                      اختر الشعبة
                    </option>
                    <option value="science">علمي علوم</option>
                    <option value="mathematics">علمي رياضة</option>
                    <option value="literary">أدبي</option>
                  </select>
                </div>

                <div className="field field-full">
                  <label htmlFor="prediction-governorate">
                    محافظتك <span className="optional-label">(اختياري)</span>
                  </label>
                  <div className="select-with-icon">
                    <MapPin size={18} aria-hidden="true" />
                    <select
                      id="prediction-governorate"
                      value={governorate}
                      onChange={(event) => {
                        setGovernorate(event.target.value);
                        setPrediction(null);
                      }}
                    >
                      <option value="">اختر المحافظة لترتيب الأقرب لك</option>
                      {egyptianGovernorates.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="field-hint">
                    نستخدمها لترتيب النتائج فقط؛ لا تغيّر فرصة القبول المحسوبة.
                  </span>
                </div>

                <div className="field field-full">
                  <span className="field-label" id="input-method-label">
                    طريقة الإدخال
                  </span>
                  <div
                    className="segmented"
                    role="group"
                    aria-labelledby="input-method-label"
                  >
                    <button
                      className="segment"
                      type="button"
                      aria-pressed={inputMethod === "score"}
                      onClick={() => setInputMethod("score")}
                    >
                      المجموع
                    </button>
                    <button
                      className="segment"
                      type="button"
                      aria-pressed={inputMethod === "percentage"}
                      onClick={() => setInputMethod("percentage")}
                    >
                      النسبة المئوية
                    </button>
                  </div>
                </div>

                {inputMethod === "score" ? (
                  <div className="field field-full">
                    <label htmlFor="score-input">مجموعك</label>
                    <div className="input-wrap">
                      <input
                        className="ltr-number"
                        id="score-input"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={score}
                        onChange={(event) => updateScore(event.target.value)}
                        placeholder="مثال: 288"
                        aria-describedby="score-hint"
                      />
                      <span className="input-suffix ltr-number">
                        من {maxScore}
                      </span>
                    </div>
                    <span className="field-hint" id="score-hint">
                      النهاية العظمى تتغير تلقائيًا حسب السنة والنظام.
                    </span>
                  </div>
                ) : (
                  <div className="field field-full">
                    <label htmlFor="percentage-input">نسبتك المئوية</label>
                    <div className="input-wrap">
                      <input
                        className="ltr-number"
                        id="percentage-input"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={percentage}
                        onChange={(event) => updatePercentage(event.target.value)}
                        placeholder="مثال: 90"
                      />
                      <span className="input-suffix">٪</span>
                    </div>
                  </div>
                )}

                <div className="score-summary" aria-live="polite">
                  <span>
                    المجموع المحسوب:{" "}
                    <strong className="ltr-number">
                      {score || "—"} / {maxScore}
                    </strong>
                  </span>
                  <span>
                    النسبة:{" "}
                    <strong className="ltr-number">
                      {percentage || "—"}%
                    </strong>
                  </span>
                </div>

                {predictionError ? (
                  <p className="form-error" role="alert">
                    <TriangleAlert size={17} aria-hidden="true" />
                    {predictionError}
                  </p>
                ) : null}

                <button
                  className="primary-button field-full"
                  type="submit"
                  disabled={predictionLoading}
                >
                  <BarChart3 size={19} aria-hidden="true" />
                  {predictionLoading
                    ? "جارٍ حساب ترتيبك..."
                    : "اعرض الكليات المتوقعة"}
                </button>
              </form>

              {predictionLoading ? <LoadingState /> : null}
              {prediction ? (
                <>
                  {prediction.branchFallback ? (
                    <p className="form-error" role="status">
                      <Info size={17} aria-hidden="true" />
                      ملف النتيجة لا يحتوي على الشعبة؛ استُخدم توزيع السنة
                      والنظام كأقرب بديل، لذلك مستوى دقة الترتيب منخفض.
                    </p>
                  ) : null}
                  <PredictionResults
                    prediction={prediction}
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    displayedPredictions={displayedPredictions}
                    proximityScope={proximityScope}
                    setProximityScope={setProximityScope}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="tool-heading">
                <div>
                  <h2>ابحث عن نتيجة الثانوية العامة</h2>
                  <p>
                    ابحث برقم الجلوس الكامل أو بجزء واضح من الاسم داخل السنة
                    المختارة.
                  </p>
                </div>
                <span className="status-tag">
                  <LockKeyhole size={13} aria-hidden="true" />
                  بحث خاص وآمن
                </span>
              </div>

              <form className="form-grid" onSubmit={submitSearch} noValidate>
                <div className="field field-full">
                  <span className="field-label" id="search-method-label">
                    البحث باستخدام
                  </span>
                  <div
                    className="segmented"
                    role="group"
                    aria-labelledby="search-method-label"
                  >
                    <button
                      className="segment"
                      type="button"
                      aria-pressed={searchMethod === "seat"}
                      onClick={() => {
                        setSearchMethod("seat");
                        setQuery("");
                        setSearchError("");
                      }}
                    >
                      رقم الجلوس
                    </button>
                    <button
                      className="segment"
                      type="button"
                      aria-pressed={searchMethod === "name"}
                      onClick={() => {
                        setSearchMethod("name");
                        setQuery("");
                        setSearchError("");
                      }}
                    >
                      الاسم
                    </button>
                  </div>
                </div>

                <div className="field">
                  <span className="field-label">سنة النتيجة</span>
                  <div className="fixed-value" aria-label="سنة النتيجة 2026">
                    <strong className="ltr-number">2026</strong>
                    <span>نتائج العام الحالي</span>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="search-query">
                    {searchMethod === "seat" ? "رقم الجلوس" : "اسم الطالب"}
                  </label>
                  <input
                    className={searchMethod === "seat" ? "ltr-number" : ""}
                    id="search-query"
                    type="text"
                    inputMode={searchMethod === "seat" ? "numeric" : "text"}
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      searchMethod === "seat"
                        ? "للتجربة: 123456"
                        : "للتجربة: محمد أحمد"
                    }
                  />
                  <span className="field-hint">
                    {searchMethod === "seat"
                      ? "يجب إدخال الرقم كاملًا."
                      : "اكتب أربعة أحرف مفيدة على الأقل."}
                  </span>
                </div>

                {searchError ? (
                  <p className="form-error" role="alert">
                    <TriangleAlert size={17} aria-hidden="true" />
                    {searchError}
                  </p>
                ) : null}

                <button
                  className="primary-button field-full"
                  type="submit"
                  disabled={searchLoading}
                >
                  <Search size={19} aria-hidden="true" />
                  {searchLoading ? "جارٍ البحث..." : "اعرض النتيجة"}
                </button>
              </form>

              {searchLoading ? <LoadingState /> : null}
              {!searchLoading && searchMessage ? (
                <div className="results-area">
                  <p className="form-error" role="status">
                    <Info size={17} aria-hidden="true" />
                    {searchMessage}
                  </p>
                </div>
              ) : null}
              {!searchLoading && searchResults.length ? (
                <div className="results-area" aria-live="polite">
                  <div className="result-banner">
                    <CheckCircle2 size={26} aria-hidden="true" />
                    <div>
                      <strong>
                        {resultCountLabel(searchTotalCount)}
                      </strong>
                      <p>
                        {searchDataMode === "preview"
                          ? "هذه نتيجة تجريبية محلية لاختبار التدفق قبل ربط قاعدة البيانات."
                          : searchTotalCount > searchResults.length
                            ? `نعرض أول ${formatNumber(searchResults.length)} نتيجة. أضف جزءًا آخر من الاسم لتضييق البحث.`
                            : "راجع الاسم ورقم الجلوس قبل الانتقال إلى توقع الكليات."}
                      </p>
                    </div>
                  </div>
                  {searchResults.map((result) => (
                    <StudentResultCard
                      key={`${result.year}-${result.seatNumber}`}
                      result={result}
                      onTransfer={() => transferResult(result)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="tool-aside" aria-label="كيف نحمي دقة وخصوصية النتائج">
          <ShieldCheck size={25} aria-hidden="true" />
          <h3>بيانات واضحة، بدون وعود مضللة</h3>
          <p>
            نوضح حدود كل توقع ونفصل البيانات الشخصية عن بيانات الكليات العامة.
          </p>
          <ul className="trust-list">
            <li>
              <span className="trust-icon">
                <Database size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>مقارنة عادلة بين السنوات</strong>
                <p>نعتمد الترتيب النسبي بدل مقارنة 320 درجة مباشرة بـ410.</p>
              </div>
            </li>
            <li>
              <span className="trust-icon">
                <LockKeyhole size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>بحث النتيجة غير عام</strong>
                <p>لا نضع الاسم أو رقم الجلوس في رابط الصفحة أو التحليلات.</p>
              </div>
            </li>
            <li>
              <span className="trust-icon">
                <BookOpenCheck size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>المرجع النهائي رسمي</strong>
                <p>التوقع يساعد على الاستكشاف، ولا يضمن القبول أو الترشيح.</p>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}

function StudentResultCard({
  result,
  onTransfer,
}: {
  result: StudentResult;
  onTransfer: () => void;
}) {
  return (
    <article className="student-card">
      <header className="student-card-header">
        <div>
          <h3>{result.studentName}</h3>
          <span>
            رقم الجلوس:{" "}
            <b className="ltr-number">{result.seatNumber}</b>
          </span>
        </div>
        <span className="category-badge category-safe">
          {result.resultStatus}
        </span>
      </header>
      <dl className="student-details">
        <div>
          <dt>السنة</dt>
          <dd className="ltr-number">{result.year}</dd>
        </div>
        <div>
          <dt>النظام</dt>
          <dd>{systemLabels[result.educationSystem]}</dd>
        </div>
        <div>
          <dt>الشعبة</dt>
          <dd>{result.branchLabel}</dd>
        </div>
        <div>
          <dt>المجموع</dt>
          <dd className="ltr-number">
            {result.totalScore === null
              ? "غير متاح"
              : `${formatNumber(result.totalScore, 1)} / ${result.maxScore ?? "—"}`}
          </dd>
        </div>
        <div>
          <dt>النسبة</dt>
          <dd className="ltr-number">
            {result.percentage === null
              ? "غير متاح"
              : `${formatNumber(result.percentage, 2)}%`}
          </dd>
        </div>
        {result.nationalRank !== null ? (
          <div className="student-rank">
            <dt>ترتيبك الخام على الجمهورية</dt>
            <dd>
              <strong className="ltr-number">
                {formatNumber(result.nationalRank)}
              </strong>
              {result.nationalTotalStudents ? (
                <span>
                  من {formatNumber(result.nationalTotalStudents)} طالب في نتائج
                  2026 — حسب المجموع فقط
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {result.governorate ? (
          <div>
            <dt>المحافظة</dt>
            <dd>{result.governorate}</dd>
          </div>
        ) : null}
      </dl>
      <div className="student-action">
        <button className="primary-button" type="button" onClick={onTransfer}>
          اعرف الكليات المتوقعة لمجموعي
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function PredictionResults({
  prediction,
  categoryFilter,
  setCategoryFilter,
  displayedPredictions,
  proximityScope,
  setProximityScope,
}: {
  prediction: PredictionResponse;
  categoryFilter: "all" | PredictionCategory;
  setCategoryFilter: (value: "all" | PredictionCategory) => void;
  displayedPredictions: FacultyPrediction[];
  proximityScope: ProximityScope;
  setProximityScope: (value: ProximityScope) => void;
}) {
  const [showFullList, setShowFullList] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("masarak_unlocked") === "true";
    }
    return false;
  });

  const handleUnlock = () => {
    setIsUnlocked(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("masarak_unlocked", "true");
    }
    window.open(
      "https://www.instagram.com/antonioss.tech",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const scopedPredictions = prediction.predictions.filter(
    (faculty) =>
      proximityScope === "all" ||
      faculty.proximityTier === "same" ||
      faculty.proximityTier === "nearby",
  );
  const viablePredictions = scopedPredictions.filter(
    (faculty) =>
      faculty.category === "target" ||
      faculty.category === "safe" ||
      faculty.category === "reach",
  );
  const highlights = selectRecommendedFaculties(scopedPredictions);
  const displayedHighlights = isUnlocked ? highlights : highlights.slice(0, 1);
  const distantCount = scopedPredictions.filter(
    (faculty) => faculty.category === "unlikely",
  ).length;

  return (
    <div className="results-area" aria-live="polite">
      <div className="prediction-overview">
        <div className="metric">
          <span>مجموعك</span>
          <strong className="ltr-number">
            {formatNumber(prediction.score, 1)} / {prediction.maxScore}
          </strong>
        </div>
        <div className="metric">
          <span>نسبتك</span>
          <strong className="ltr-number">
            {formatNumber(prediction.percentage, 2)}%
          </strong>
        </div>
        <div className="metric">
          <span>ترتيبك التقديري</span>
          <strong className="ltr-number">
            {formatNumber(prediction.estimatedRank)}
          </strong>
        </div>
        <div className="metric">
          <span>طلاب أعلى منك</span>
          <strong className="ltr-number">
            {formatNumber(prediction.studentsAboveScore)}
          </strong>
        </div>
        <div className="metric">
          <span>دقة التوقع</span>
          <strong>{prediction.confidence}</strong>
        </div>
      </div>

      <VodafoneCashSupport
        score={prediction.score}
        percentage={prediction.percentage}
      />

      {prediction.governorate ? (
        <div className="proximity-toolbar" aria-label="نطاق المحافظات">
          <div>
            <span className="eyebrow">
              <MapPin size={14} aria-hidden="true" />
              محافظتك: {prediction.governorate}
            </span>
            <p>نرتّب الأقرب أولًا، مع إمكانية عرض كل المحافظات في أي وقت.</p>
          </div>
          <div className="scope-switch" role="group" aria-label="نطاق عرض الكليات">
            <button
              type="button"
              aria-pressed={proximityScope === "nearby"}
              onClick={() => setProximityScope("nearby")}
            >
              <MapPin size={15} aria-hidden="true" />
              الأقرب لمحافظتي
            </button>
            <button
              type="button"
              aria-pressed={proximityScope === "all"}
              onClick={() => setProximityScope("all")}
            >
              <Globe2 size={15} aria-hidden="true" />
              كل المحافظات
            </button>
          </div>
        </div>
      ) : null}

      <div className="recommendations">
        <div className="recommendation-heading">
          <div>
            <span className="recommendation-count">
              أقرب {Math.min(5, viablePredictions.length)} اختيارات
            </span>
            <h2>الكليات الأقرب لمجموعك</h2>
            <p>
              مرتبة من الأكثر توقعًا إلى ما يحتاج انخفاضًا بسيطًا في الحد.
            </p>
          </div>
        </div>
        {displayedHighlights.length ? (
          displayedHighlights.map((faculty) => (
            <FacultyResult
              key={faculty.id}
              faculty={faculty}
              showProximity={Boolean(prediction.governorate)}
            />
          ))
        ) : (
          <div className="empty-results" role="status">
            <Info size={19} aria-hidden="true" />
            <div>
              <strong>لا توجد اختيارات قريبة داخل النطاق المحدد.</strong>
              <p>اعرض كل المحافظات لتوسيع دائرة البحث.</p>
            </div>
            {proximityScope === "nearby" ? (
              <button type="button" onClick={() => setProximityScope("all")}>
                اعرض كل المحافظات
              </button>
            ) : null}
          </div>
        )}

        {!isUnlocked && highlights.length > 1 ? (
          <InstagramLockCard
            onUnlock={handleUnlock}
            remainingCount={Math.max(1, highlights.length - 1)}
            nextFaculty={highlights[1]}
            showProximity={Boolean(prediction.governorate)}
          />
        ) : null}
      </div>

      <button
        className="secondary-disclosure"
        type="button"
        aria-expanded={showFullList}
        onClick={() => setShowFullList((current) => !current)}
      >
        <span>
          {showFullList ? "إخفاء باقي الخيارات" : "عرض باقي الخيارات"}
          <small>
            {Math.max(0, viablePredictions.length - highlights.length)} اختيارًا
            إضافيًا، و{distantCount} بعيدًا عن مجموعك
          </small>
        </span>
        {showFullList ? (
          <ChevronUp size={18} aria-hidden="true" />
        ) : (
          <ChevronDown size={18} aria-hidden="true" />
        )}
      </button>

      {showFullList ? (
        <>
          <div className="field result-filter">
            <label htmlFor="category-filter">اعرض حسب فرصة القبول</label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as "all" | PredictionCategory,
                )
              }
            >
              <option value="all">كل الاختيارات داخل النطاق</option>
              <option value="target">الأقرب للحد المتوقع</option>
              <option value="safe">فرص مرتفعة</option>
              <option value="reach">اختيارات طموحة</option>
              <option value="unlikely">بعيدة عن مجموعي</option>
            </select>
          </div>

          <div className="recommendations detailed-recommendations">
            {displayedPredictions.length ? (
              displayedPredictions.map((faculty) => (
                <FacultyResult
                  key={`all-${faculty.id}`}
                  faculty={faculty}
                  showProximity={Boolean(prediction.governorate)}
                />
              ))
            ) : (
              <div className="empty-results" role="status">
                <Info size={19} aria-hidden="true" />
                <div>
                  <strong>لا توجد كليات مطابقة داخل هذا النطاق.</strong>
                  <p>جرّب تغيير تصنيف الفرصة أو عرض باقي المحافظات.</p>
                </div>
                {proximityScope === "nearby" ? (
                  <button
                    type="button"
                    onClick={() => setProximityScope("all")}
                  >
                    اعرض باقي المحافظات
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : null}

      <p className="prediction-disclaimer">
        {prediction.dataMode === "preview"
          ? "قائمة الكليات وحدود 2025 مأخوذة من بوابة التنسيق الرسمية، أما نطاق 2026 والترتيب التقديري فهما معاينة استرشادية إلى أن تتوفر بيانات العام وتوزيعاته النهائية. "
          : null}
        التوقعات لا تمثل نتيجة رسمية أو ضمانًا للقبول. ترتيب القرب استرشادي ولا
        يطبّق قواعد التوزيع الجغرافي الخاصة بمدرستك وإدارتك التعليمية.
      </p>
    </div>
  );
}

function FacultyResult({
  faculty,
  showProximity = false,
}: {
  faculty: FacultyPrediction;
  showProximity?: boolean;
}) {
  const expectedMidpoint =
    (faculty.expectedRange[0] + faculty.expectedRange[1]) / 2;
  const studentPercentage = expectedMidpoint + faculty.difference;
  const distanceFromRange =
    faculty.category === "safe"
      ? Math.max(0, studentPercentage - faculty.expectedRange[1])
      : Math.max(0, faculty.expectedRange[0] - studentPercentage);
  const categorySummary =
    faculty.category === "safe"
      ? `مجموعك أعلى من النطاق المتوقع بحوالي ${distanceFromRange.toFixed(2)}%.`
      : faculty.category === "target"
        ? "مجموعك داخل النطاق المتوقع لهذه الكلية."
        : faculty.category === "reach"
          ? `تحتاج أن ينخفض الحد بحوالي ${distanceFromRange.toFixed(2)}% لتدخل نطاق التوقع.`
          : faculty.category === "unlikely"
            ? `الفارق عن بداية النطاق حوالي ${distanceFromRange.toFixed(2)}%.`
            : "نحتاج بيانات أكثر قبل تقدير فرصتك.";

  return (
    <article className="faculty-result">
      <div>
        <h4>
          {faculty.facultyName} — {faculty.universityName}
        </h4>
        <div className="faculty-meta">
          <span className="faculty-location">
            <MapPin size={13} aria-hidden="true" />
            {faculty.governorate}
          </span>
          {showProximity ? (
            <span className={`proximity-badge proximity-${faculty.proximityTier}`}>
              {faculty.proximityLabel}
            </span>
          ) : null}
          <span>{faculty.sector}</span>
        </div>
        <div className="faculty-cutoffs">
          <span>
            المتوقع 2026:{" "}
            <b className="ltr-number">
              {faculty.expectedRange[0]}%–{faculty.expectedRange[1]}%
            </b>
          </span>
          <span>
            حد 2025:{" "}
            <b className="ltr-number">
              {faculty.official2025Score} / 320
            </b>
          </span>
        </div>
        <p className="faculty-chance-copy">{categorySummary}</p>
      </div>
      <span
        className={`category-badge ${categoryClass[faculty.category]}`}
        title={`مستوى الثقة: ${faculty.confidence}`}
      >
        {categoryLabels[faculty.category]}
      </span>
    </article>
  );
}

function InstagramLockCard({
  onUnlock,
  remainingCount,
  nextFaculty,
  showProximity = false,
}: {
  onUnlock: () => void;
  remainingCount: number;
  nextFaculty?: FacultyPrediction;
  showProximity?: boolean;
}) {
  return (
    <div
      className="locked-faculty-wrapper"
      onClick={onUnlock}
      role="button"
      tabIndex={0}
      title="اضغط للمتابعة على Instagram وتفعيل باقي الكليات"
    >
      {nextFaculty ? (
        <div className="blurred-faculty-preview" aria-hidden="true">
          <FacultyResult faculty={nextFaculty} showProximity={showProximity} />
        </div>
      ) : null}
      <div className="instagram-lock-overlay">
        <div className="lock-overlay-content">
          <div className="lock-icon-badge">
            <LockKeyhole size={20} aria-hidden="true" />
          </div>
          <div>
            <h3>🔒 +{remainingCount} كليات واختيارات إضافية مقفولة</h3>
            <p>تابعنا على إنستغرام لفك القفل فوراً وإظهار باقي الكليات 🎓</p>
          </div>
        </div>
        <button
          type="button"
          className="instagram-unlock-btn"
          onClick={(e) => {
            e.stopPropagation();
            onUnlock();
          }}
        >
          <Instagram size={18} aria-hidden="true" />
          تابعنا على Instagram لفك القفل
        </button>
      </div>
    </div>
  );
}

function VodafoneCashSupport({
  score,
  percentage,
}: {
  score: number;
  percentage: number;
}) {
  const [copied, setCopied] = useState(false);
  const vfCashNumber = "01001014231";
  const vfCashUrl = "http://vf.eg/vfcash?id=mt&qrId=hpSxBH";

  if (score <= 290 && percentage <= 90.6) return null;

  function copyNumber() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(vfCashNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  return (
    <div className="vfcash-support-card">
      <div className="vfcash-header">
        <span className="vfcash-badge">
          <HeartHandshake size={15} aria-hidden="true" />
          🎉 ألف مبروك هذا المجموع المتميز!
        </span>
        <h3>تقديرًا للمجهود ودعمًا لاستمرار الخدمة</h3>
        <p>
          فخورين بتميزك وتفوقك! إذا أسعدك هذا التقرير وساعَدك في استكشاف كليتك المستقبلية، يمكنك تقديم لفتة تقديرية بسيطة لدعم المطور والمساهمة في استمرار وتطوير منصة مسارك.
        </p>
      </div>
      <div className="vfcash-details">
        <div className="vfcash-number-row">
          <span className="vfcash-label">رقم فودافون كاش:</span>
          <strong className="ltr-number vfcash-number">{vfCashNumber}</strong>
          <button type="button" className="vfcash-copy-btn" onClick={copyNumber}>
            {copied ? "تم النسخ! ✓" : "نسخ الرقم"}
          </button>
        </div>
        <a
          className="vfcash-link-btn"
          href={vfCashUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          إرسال لفتة تقدير عبر فودافون كاش
        </a>
      </div>
    </div>
  );
}

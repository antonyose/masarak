"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
};
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
type PredictionResponse = LegacyPredictionResponse | V2PredictionResponse;
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
};
type ProductType = "single" | "friends_3";

const branchLabels: Record<Branch, string> = {
  science: "علمي علوم",
  mathematics: "علمي رياضة",
  literary: "أدبي",
};

const categoryLabels: Record<Recommendation["category"], string> = {
  safe: "مناسب جدًا",
  target: "مناسب ليك",
  reach: "اختيار طموح",
  unlikely: "بعيد عن مجموعك",
  insufficient_data: "لسه بنحدّثه",
};

const offerLines = [
  "افتح التقرير الكامل وخد باقي الترشيحات",
  "خطوة بسيطة تطمّنك وتسهّل قرارك",
  "اعرف اختياراتك الأقرب بشكل أوضح",
  "تقرير واحد للمرحلة الثانية والثالثة",
];

function simpleProximity(label: string) {
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

export function ToolExperience() {
  const [seatNumber, setSeatNumber] = useState("");
  const [result, setResult] = useState<StudentResult | null>(null);
  const [branch, setBranch] = useState<Branch | "">("");
  const [governorate, setGovernorate] = useState("");
  const [report, setReport] = useState<PredictionResponse | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [requestedProduct, setRequestedProduct] = useState<ProductType>("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const trackFunnel = useTrackFunnel();

  async function findResult(value: string) {
    const response = await fetch("/api/result-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026, method: "seat", query: value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const found = data.results?.[0] as StudentResult | undefined;
    if (!found) throw new Error("راجع رقم الجلوس وحاول تاني.");
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

  async function submitSeat(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const found = await findResult(seatNumber);
      setResult(found);
      trackFunnel("search_result");
      setGovernorate(found.governorate ?? "");
      const knownBranch = found.branch === "unknown" ? undefined : found.branch;
      setBranch(knownBranch ?? "");
      const nextReport = await createReport(found, knownBranch, found.governorate ?? undefined);
      if (!nextReport.requiresBranch) {
        setReport(nextReport);
        trackFunnel("report_viewed", { source: "seat_search" });
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

  return (
    <div className="conversion-shell bg-white shadow-[0_6px_8px_rgba(15,42,61,.08)]">
      <div className="conversion-intro">
        <div>
          <span className="conversion-badge">
            <Sparkles size={15} aria-hidden="true" />
            <span>
              <b>السيستم اتحدّث</b>
              <small>بعد نتيجة المرحلة الأولى — التوقعات أدق بكتير</small>
            </span>
          </span>
          <h2>اعرف أقرب كلياتك برقم الجلوس</h2>
        </div>
        <ol className="journey-steps" aria-label="خطوات التقرير">
          <li className="is-current"><b>1</b><span>رقم الجلوس</span></li>
          <li className={result ? "is-current" : ""}><b>2</b><span>الشعبة</span></li>
          <li className={report ? "is-current" : ""}><b>3</b><span>الترشيحات</span></li>
        </ol>
      </div>

      <div className="conversion-body">
        {!result ? (
          <form onSubmit={submitSeat} className="seat-form">
            <label htmlFor="seat-number">رقم الجلوس</label>
            <div className="seat-entry-row">
              <div className="seat-input-wrap">
                <Search size={20} aria-hidden="true" />
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
              </div>
              <button type="submit" className="conversion-primary" disabled={loading}>
                {loading ? "بندور على نتيجتك…" : "شوف أقرب كلياتك"}
                {!loading ? <ArrowLeft size={18} aria-hidden="true" /> : null}
              </button>
            </div>
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
              <button type="button" onClick={resetJourney}>تغيير الرقم</button>
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
              <span>{categoryLabels[item.category]}</span>
              <h4>{item.officialNameArabic}</h4>
              <p>{simpleProximity(item.proximityLabel)}</p>
              {item.requiresAptitudeTest ? <small>محتاج اختبار قدرات</small> : null}
            </div>
            <GraduationCap size={30} aria-hidden="true" />
          </article>
        ))}
      </div>

      {!report.premium && report.lockedRecommendationCount ? (
        <section className="locked-recommendations" aria-label="ترشيحات مقفولة">
          <div className="locked-title">
            <LockKeyhole size={19} aria-hidden="true" />
            <div>
              <strong>باقي الترشيحات متاحة بعد التفعيل</strong>
              <span>شوف كل الاختيارات المناسبة لمجموعك ومحافظتك</span>
            </div>
          </div>

          <div className="locked-card-stack" aria-hidden="true">
            {[0, 1, 2].map((item) => <LockedSampleCard key={item} index={item} />)}
          </div>

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
        <button type="button" onClick={onReset}>ابدأ من جديد</button>
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
          <strong>التقرير مفتوح — لكنه توقع، مش إتاحة رسمية</strong>
          <p>{report.eligibility.message}</p>
        </div>
      ) : null}

      <div className="v2-report-sections">
        {sections.map((section) => section.items.length ? (
          <section key={section.key} className="v2-report-section" aria-labelledby={`section-${section.key}`}>
            <h4 id={`section-${section.key}`}>{section.title}</h4>
            <div className="v2-recommendation-grid">
              {section.items.map((item, index) => (
                <article key={item.id} className={`free-recommendation v2-recommendation fit-${item.fit}`}>
                  <div className="recommendation-number">{index + 1}</div>
                  <div className="recommendation-copy">
                    <span>{item.fitLabel}</span>
                    <h4>{item.officialNameArabic}</h4>
                    <p>
                      {item.availability === "forecast_stage_3" ? "متوقع يظهر في المرحلة الثالثة · " : "متاح في قائمة المرحلة الثانية · "}
                      نطاق متوقع <bdi className="ltr-number">{item.expectedRange[0]}%–{item.expectedRange[1]}%</bdi>
                    </p>
                    <small>{simpleProximity(item.proximityLabel)}</small>
                    {item.requiresAptitudeTest ? <small className="recommendation-warning">يتطلب اجتياز اختبار قدرات</small> : null}
                    {item.limitedDataWarning ? <small className="recommendation-warning">{item.limitedDataWarning}</small> : null}
                  </div>
                  <GraduationCap size={28} aria-hidden="true" />
                </article>
              ))}
            </div>
          </section>
        ) : null)}
      </div>

      {!report.premium && report.lockedRecommendationCount ? (
        <section className="locked-recommendations" aria-label="ترشيحات مقفولة">
          <div className="locked-title">
            <LockKeyhole size={19} aria-hidden="true" />
            <div>
              <strong>باقي التقرير متاح بعد التفعيل</strong>
              <span>
                {isStage3Report
                  ? `${report.lockedRecommendationCount} توقعات إضافية مرتبة حسب قربها من مجموعك`
                  : "شوف كل الاختيارات المناسبة لمجموعك ومحافظتك"}
              </span>
            </div>
          </div>
          <div className="locked-card-stack" aria-hidden="true">
            {[0, 1, 2].map((item) => <LockedSampleCard key={item} index={item} />)}
          </div>
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

function LockedSampleCard({ index }: { index: number }) {
  return (
    <div className={`locked-sample locked-sample-${index + 1}`}>
      <div className="locked-sample-content">
        <span>اختيار مناسب</span>
        <strong>كلية وجامعة مناسبة لمجموعك</strong>
        <small>المحافظة · فرصة القبول</small>
      </div>
      <span className="locked-icon"><LockKeyhole size={16} /></span>
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
  const [lineIndex, setLineIndex] = useState(0);
  const [productType, setProductType] = useState<ProductType>(initialProduct);
  const [friendSeats, setFriendSeats] = useState<[string, string]>(["", ""]);
  const [seatError, setSeatError] = useState("");
  const [method, setMethod] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setLineIndex((current) => (current + 1) % offerLines.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

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
    if (!settings || !selectedProduct || !method || !receipt) {
      setError("اختار طريقة الدفع وارفع صورة الإيصال.");
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
          method,
          idempotencyKey: crypto.randomUUID(),
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
      if (data.payment.hasReceipt) {
        trackFunnel("payment_submitted", { product: productType, source: "locked_report" });
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
      <div className="offer-main">
        <span className="offer-label">{selectedOffer?.title ?? "تقريرك الكامل"}</span>
        <h4>افتح كل الترشيحات المناسبة ليك</h4>
        <p className="offer-rotator" key={lineIndex}>{offerLines[lineIndex]}</p>
        <ul>
          <li><Check size={16} /> كل الاختيارات المناسبة لمجموعك</li>
          <li><Check size={16} /> يشمل المرحلة الثانية والثالثة</li>
          <li><Check size={16} /> بدون حساب — برقم الجلوس فقط</li>
        </ul>
      </div>
      <div className="offer-action">
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
        <div className="offer-price-line"><span>السعر</span><strong><bdi>{selectedProduct?.priceEgp}</bdi> جنيه</strong></div>
        {seatError ? <p className="payment-inline-error" role="alert">{seatError}</p> : null}
        <div className="payment-method-grid" role="radiogroup" aria-label="طرق الدفع">
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
        <label className="receipt-picker"><Upload size={17} /><span>{receipt ? receipt.name : "ارفع صورة الإيصال — حتى 5MB"}</span><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { const file = event.target.files?.[0] ?? null; setReceipt(file); if (file) trackFunnel("receipt_uploaded", { product: productType, source: "locked_report" }); }} /></label>
        {mode === "rejected" ? <p className="payment-rejected">لم تتم الموافقة على الطلب السابق. يمكنك إرسال إيصال جديد.</p> : null}
        {error ? <p className="payment-inline-error" role="alert">{error}</p> : null}
        <button className="offer-cta" disabled={mode === "submitting"}>
          {mode === "submitting" ? "جارٍ إرسال الإيصال…" : selectedOffer?.ctaText ?? (productType === "friends_3" ? "ادفع وافتح التقارير" : "افتح تقريري")}
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

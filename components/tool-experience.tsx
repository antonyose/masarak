"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  GraduationCap,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { egyptianGovernorates } from "@/lib/governorates";

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
type PredictionResponse = {
  predictionId?: string;
  eligibility: { eligible: boolean };
  recommendations: Recommendation[];
  lockedRecommendationCount?: number;
  premium?: boolean;
};
type PredictionApiResponse = PredictionResponse & {
  report?: PredictionResponse;
  error?: string;
};
type PaymentSettings = {
  priceEgp: string;
  methods: Array<{ id: string; label: string; recipient: string }>;
};

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

function simpleProximity(label: string) {
  return label === "نطاق قريب استرشادي" ? "قريبة منك" : label;
}

const offerLines = [
  "اعرف أقرب كلياتك بشكل أوضح",
  "افتح التقرير الكامل وخد باقي الترشيحات",
  "خطوة بسيطة تطمّنك وتسهّل قرارك",
  "تقرير واحد للمرحلة الثانية والثالثة",
  "مبلغ بسيط يساعدك تختار وأنت مطمّن",
];

export function ToolExperience() {
  const { data: session, isPending } = useSession();
  const [seatNumber, setSeatNumber] = useState("");
  const [result, setResult] = useState<StudentResult | null>(null);
  const [branch, setBranch] = useState<Branch | "">("");
  const [governorate, setGovernorate] = useState("");
  const [report, setReport] = useState<PredictionResponse | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resumeHandled = useRef(false);

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
    selectedBranch: Branch,
    selectedGovernorate?: string,
  ) {
    if (session?.user) {
      const savedResponse = await fetch("/api/saved-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: 2026,
          seatNumber: student.seatNumber,
          branch: selectedBranch,
        }),
      });
      const saved = await savedResponse.json();
      if (!savedResponse.ok) throw new Error(saved.error);
      const predictionResponse = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savedStudentId: saved.student.id,
          governorate: selectedGovernorate || undefined,
        }),
      });
      const prediction = (await predictionResponse.json()) as PredictionApiResponse;
      if (!predictionResponse.ok) throw new Error(prediction.error);
      if (prediction.premium && prediction.report) {
        return {
          ...prediction.report,
          predictionId: prediction.predictionId,
          premium: true,
        };
      }
      return prediction;
    }

    const previewResponse = await fetch("/api/predictions/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: 2026,
        educationSystem: student.educationSystem,
        branch: selectedBranch,
        score: student.totalScore,
        percentage: student.percentage,
        governorate: selectedGovernorate || undefined,
        seatNumber: student.seatNumber,
      }),
    });
    const preview = await previewResponse.json();
    if (!previewResponse.ok) throw new Error(preview.error);
    return preview as PredictionResponse;
  }

  async function submitSeat(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const found = await findResult(seatNumber);
      setResult(found);
      setBranch(found.branch === "unknown" ? "" : found.branch);
      if (
        found.governorate &&
        egyptianGovernorates.includes(
          found.governorate as (typeof egyptianGovernorates)[number],
        )
      ) {
        setGovernorate(found.governorate);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تجهيز الترشيح.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isPending || resumeHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const resumedSeat = params.get("seat");
    const resumedBranch = params.get("branch") as Branch | null;
    if (!resumedSeat || !resumedBranch || !session?.user) return;
    resumeHandled.current = true;
    const resumedGovernorate = params.get("governorate") || "";
    setSeatNumber(resumedSeat);
    setBranch(resumedBranch);
    setGovernorate(resumedGovernorate);
    setLoading(true);
    void findResult(resumedSeat)
      .then(async (found) => {
        setResult(found);
        setReport(await createReport(found, resumedBranch, resumedGovernorate));
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "تعذر استكمال التقرير."),
      )
      .finally(() => setLoading(false));
  }, [isPending, session?.user]);

  useEffect(() => {
    if (!session?.user || !report || report.premium) return;
    void fetch("/api/payment-settings")
      .then(async (response) => {
        if (response.ok) setSettings(await response.json());
      })
      .catch(() => undefined);
  }, [report, session?.user]);

  function resetJourney() {
    setResult(null);
    setReport(null);
    setBranch("");
    setGovernorate("");
    setError("");
  }

  return (
    <div className="conversion-shell bg-white shadow-[0_6px_8px_rgba(15,42,61,.08)]">
      <div className="conversion-intro">
        <div>
          <span className="conversion-badge">
            <Sparkles size={15} aria-hidden="true" />
            توقعات محدثة لتنسيق 2026
          </span>
          <h2>اعرف أقرب كلياتك برقم الجلوس</h2>
          <p>أول ترشيح مجانًا، والتقرير الكامل للمرحلة الثانية والثالثة.</p>
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
            <p className="seat-helper">
              <ShieldCheck size={15} aria-hidden="true" />
              بنستخدم نتيجتك علشان الترشيحات تكون مناسبة ليك.
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
              <select
                value={governorate}
                onChange={(event) => setGovernorate(event.target.value)}
              >
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
            signedIn={Boolean(session?.user)}
            settings={settings}
            onReset={resetJourney}
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
  signedIn,
  settings,
  onReset,
}: {
  report: PredictionResponse;
  result: StudentResult;
  branch: Branch;
  governorate: string;
  signedIn: boolean;
  settings: PaymentSettings | null;
  onReset: () => void;
}) {
  const recommendations = report.premium
    ? report.recommendations
    : report.recommendations.slice(0, 1);
  const loginParams = new URLSearchParams({
    seat: result.seatNumber,
    branch,
  });
  if (governorate) loginParams.set("governorate", governorate);
  const returnPath = `/?${loginParams.toString()}`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;

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
          <span>{report.premium ? "تقريرك الكامل" : "ترشيحك المجاني"}</span>
          <h3>{report.premium ? "دي أقرب اختياراتك" : "بداية مبشّرة ليك"}</h3>
        </div>
        <button type="button" onClick={onReset}>ابدأ من جديد</button>
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

          {!signedIn ? (
            <div className="signin-unlock">
              <div>
                <h4>سجّل دخولك علشان تكمّل تقريرك</h4>
                <p>حساب واحد يحفظ نتيجتك وترشيحاتك لحد المرحلة الثالثة.</p>
              </div>
              <Link href={loginHref} className="conversion-primary">
                تسجيل الدخول أو حساب جديد
                <ArrowLeft size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : report.predictionId ? (
            <UnlockOffer predictionId={report.predictionId} settings={settings} />
          ) : null}
        </section>
      ) : null}

      <p className="report-note">الترشيحات استرشادية، والنتيجة النهائية حسب موقع التنسيق.</p>
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

function UnlockOffer({
  predictionId,
  settings,
}: {
  predictionId: string;
  settings: PaymentSettings | null;
}) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setLineIndex((current) => (current + 1) % offerLines.length),
      3200,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="unlock-offer">
      <div className="offer-main">
        <span className="offer-label">عرض التقرير الكامل</span>
        <h4>افتح كل الترشيحات المناسبة ليك</h4>
        <p className="offer-rotator" key={lineIndex}>{offerLines[lineIndex]}</p>
        <ul>
          <li><Check size={16} /> كل الاختيارات المناسبة لمجموعك</li>
          <li><Check size={16} /> يشمل تحديثات المرحلة الثانية والثالثة</li>
          <li><Check size={16} /> دفعة واحدة لنفس نتيجة 2026</li>
        </ul>
      </div>
      <div className="offer-action">
        {settings ? (
          <>
            <span>التقرير الكامل</span>
            <strong><bdi>{settings.priceEgp}</bdi> ج.م</strong>
            <div className="payment-method-chips">
              {settings.methods.map((method) => <small key={method.id}>{method.label}</small>)}
            </div>
          </>
        ) : <div className="offer-price-skeleton" aria-label="جارٍ تحميل السعر" />}
        <Link href={`/account?prediction=${predictionId}`} className="offer-cta">
          كمّل الدفع وافتح التقرير
          <ChevronLeft size={19} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

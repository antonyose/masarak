import stage2SeedJson from "@/lib/coordination-data/stage2-2026.json";
import historicalJson from "@/lib/coordination-data/historical-cutoffs-2023-2025.json";
import type { Branch, EducationSystem } from "@/lib/grade-scales";
import {
  egyptianGovernorates,
  getProximityTier,
  proximityLabels,
  proximityRank,
  type ProximityTier,
} from "@/lib/governorates";
import { normalizeArabicName } from "@/lib/normalize-arabic";

export type FacultyStageStatus =
  | "officially_closed_stage_1"
  | "available_stage_2"
  | "availability_unknown"
  | "not_eligible_current_stage";
export type PredictionMode = "rank_percentile" | "normalized_percentage";
export type PredictionCategory =
  | "safe"
  | "target"
  | "reach"
  | "unlikely"
  | "insufficient_data";
export type PredictionConfidence = "مرتفعة" | "متوسطة" | "منخفضة";

export type Stage2ModelData = {
  model: {
    version: string;
    mode: "normalized_percentage" | "rank_percentile";
    historicalWeights?: Record<string, number>;
    minimumUncertainty?: number;
    classificationBoundaries?: { safeUncertaintyMultiple: number; targetLowerMultiple: number; reachLowerMultiple: number };
  } & Record<string, unknown>;
  stageRules: Array<{ stage: number; educationSystem: EducationSystem; branch: Branch; minimumScore: number; maximumScore: number; minimumPercentage: number; studentCount?: number | null }>;
  stageVacancies: Array<{ facultyKey: string; officialNameArabic: string; educationSystem: EducationSystem; branch: Branch; stage: number; requiresAptitudeTest: boolean }>;
  officialCutoffs: Array<{ facultyKey: string; officialNameArabic: string; score: number; maximumScore: number; percentage: number; educationSystem: EducationSystem; branch: Branch; stage: number }>;
};
export type Stage2HistoricalRow = { year: number; educationSystem: EducationSystem; branch: Branch; facultyKey: string; officialNameArabic: string; minimumScore: number; maximumScore: number; minimumPercentage: number; sourceUrl: string };
type Vacancy = Stage2ModelData["stageVacancies"][number];
type OfficialCutoff = Stage2ModelData["officialCutoffs"][number];

export type Stage2Recommendation = {
  id: string;
  officialNameArabic: string;
  facultyKey: string;
  branch: Branch;
  status: "available_stage_2";
  predictedCutoffPercentage: number;
  expectedRange: [number, number];
  uncertainty: number;
  category: PredictionCategory;
  confidence: PredictionConfidence;
  difference: number;
  historicalCutoffs: Partial<Record<2023 | 2024 | 2025, number>>;
  requiresAptitudeTest: boolean;
  governorate: string | null;
  proximityTier: ProximityTier;
  proximityLabel: string;
  explanation: string;
};

export type Stage2Report = {
  year: 2026;
  coordinationStage: 2;
  modelVersion: string;
  modelMode: PredictionMode;
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  branchSource: "user_provided" | "dataset" | "official";
  governorate: string | null;
  eligibility: {
    eligible: boolean;
    status: FacultyStageStatus;
    minimumScore: number;
    minimumPercentage: number;
    message: string;
  };
  confidence: PredictionConfidence;
  recommendations: Stage2Recommendation[];
  officialClosedFacts: Array<{
    id: string;
    officialNameArabic: string;
    status: "officially_closed_stage_1";
    score: number;
    maximumScore: number;
    percentage: number;
  }>;
  unavailableCount: number;
  unknownCount: number;
  disclaimer: string;
};

export type FreeStage2Report = Omit<Stage2Report, "recommendations"> & {
  recommendations: Stage2Recommendation[];
  lockedRecommendationCount: number;
  totalRecommendationCount: number;
  premium: false;
};

const seed = stage2SeedJson as unknown as Stage2ModelData;
const historicalRows = historicalJson.rows as unknown as Stage2HistoricalRow[];
const categoryOrder: Record<PredictionCategory, number> = {
  target: 0,
  safe: 1,
  reach: 2,
  unlikely: 3,
  insufficient_data: 4,
};

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sector(label: string) {
  const normalized = normalizeArabicName(label);
  const rules: Array<[RegExp, string]> = [
    [/^طب اسنان|طب وجراحة الفم/u, "dentistry"],
    [/^طب بيطري/u, "veterinary"],
    [/^طب/u, "medicine"],
    [/^صيدلة/u, "pharmacy"],
    [/^علاج طبيعي/u, "physiotherapy"],
    [/^(حاسبات|ذكاء اصطناعي|الذكاء الاصطناعي)/u, "computing"],
    [/^هندسة/u, "engineering"],
    [/^تمريض/u, "nursing"],
    [/^علوم/u, "science"],
    [/^(اقتصاد|سياسة|الدراسات الاقتصادية)/u, "economics"],
    [/^السن/u, "languages"],
    [/^اعلام/u, "media"],
    [/^تجارة/u, "commerce"],
    [/^حقوق/u, "law"],
    [/^تربية/u, "education"],
    [/^اداب/u, "arts"],
  ];
  return rules.find(([pattern]) => pattern.test(normalized))?.[1] ?? "other";
}

function inferGovernorate(label: string) {
  const normalized = normalizeArabicName(label);
  const aliases: Array<[string, string]> = [
    ["حلوان", "القاهرة"],
    ["العاصمة", "القاهرة"],
    ["عين شمس", "القاهرة"],
    ["بور سعيد", "بورسعيد"],
    ["الاسماعيلية", "الإسماعيلية"],
    ["جنوب الوادي", "قنا"],
    ["الغردقة", "البحر الأحمر"],
    ["العريش", "شمال سيناء"],
    ["السادات", "المنوفية"],
  ];
  for (const [needle, governorate] of aliases) {
    if (normalized.includes(normalizeArabicName(needle))) return governorate;
  }
  return (
    egyptianGovernorates.find((item) =>
      normalized.includes(normalizeArabicName(item)),
    ) ?? null
  );
}

function historyFor(vacancy: Vacancy, historyRows: Stage2HistoricalRow[]) {
  const byYear = new Map<number, number>();
  for (const row of historyRows) {
    if (
      row.facultyKey !== vacancy.facultyKey ||
      row.branch !== vacancy.branch ||
      ![2023, 2024, 2025].includes(row.year)
    ) {
      continue;
    }
    if (!byYear.has(row.year)) byYear.set(row.year, row.minimumPercentage);
  }
  return byYear;
}

function historicalBaseline(history: Map<number, number>, configuredWeights?: Record<string, number>) {
  const weights: Record<number, number> = {
    2025: configuredWeights?.["2025"] ?? 0.5,
    2024: configuredWeights?.["2024"] ?? 0.3,
    2023: configuredWeights?.["2023"] ?? 0.2,
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const [year, value] of history) {
    const weight = weights[year] ?? 0;
    weighted += value * weight;
    totalWeight += weight;
  }
  return totalWeight ? weighted / totalWeight : null;
}

function calibrationShifts(branch: Branch, modelData: Stage2ModelData, historyRows: Stage2HistoricalRow[]) {
  const grouped = new Map<string, number[]>();
  for (const cutoff of modelData.officialCutoffs) {
    if (cutoff.branch !== branch) continue;
    const history = historyFor({
      facultyKey: cutoff.facultyKey,
      officialNameArabic: cutoff.officialNameArabic,
      educationSystem: "new",
      branch: cutoff.branch,
      stage: 2,
      requiresAptitudeTest: false,
    }, historyRows);
    const baseline = historicalBaseline(history, modelData.model.historicalWeights);
    if (baseline == null) continue;
    const group = sector(cutoff.officialNameArabic);
    const values = grouped.get(group) ?? [];
    values.push(cutoff.percentage - baseline);
    grouped.set(group, values);
  }
  return new Map([...grouped].map(([key, values]) => [key, median(values)]));
}

function classify(margin: number, uncertainty: number, boundaries?: Stage2ModelData["model"]["classificationBoundaries"]): PredictionCategory {
  const configured = boundaries ?? { safeUncertaintyMultiple: 1, targetLowerMultiple: -0.35, reachLowerMultiple: -1 };
  if (margin >= configured.safeUncertaintyMultiple * uncertainty) return "safe";
  if (margin >= configured.targetLowerMultiple * uncertainty) return "target";
  if (margin >= configured.reachLowerMultiple * uncertainty) return "reach";
  return "unlikely";
}

function recommendationExplanation(
  category: PredictionCategory,
  uncertainty: number,
  requiresAptitudeTest: boolean,
) {
  const base =
    category === "safe"
      ? "مجموعك أعلى من النطاق المتوقع مع هامش أمان محسوب."
      : category === "target"
        ? "مجموعك قريب من الحد المتوقع وفق التاريخ ومعايرة نتيجة المرحلة الأولى."
        : category === "reach"
          ? "اختيار طموح يقع داخل نطاق عدم اليقين الحالي."
          : "الفارق أكبر من نطاق عدم اليقين الحالي.";
  return `${base} هامش عدم اليقين ±${round(uncertainty)} نقطة مئوية.${
    requiresAptitudeTest ? " ويتطلب اجتياز اختبار القدرات عند انطباقه." : ""
  }`;
}

function stageRule(modelData: Stage2ModelData, system: EducationSystem, branch: Branch) {
  return modelData.stageRules.find(
    (rule) => rule.educationSystem === system && rule.branch === branch,
  );
}

export function calculateStage2Report({
  score,
  maxScore,
  percentage,
  educationSystem,
  branch,
  governorate,
  branchSource = "user_provided",
  modelData = seed,
  historyRows = historicalRows,
}: {
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  governorate?: string;
  branchSource?: "user_provided" | "dataset" | "official";
  modelData?: Stage2ModelData;
  historyRows?: Stage2HistoricalRow[];
}): Stage2Report {
  const rule = stageRule(modelData, educationSystem, branch);
  if (!rule) throw new Error("No active Stage-2 rule for this system and branch.");
  const eligible = score >= rule.minimumScore;
  const baseReport = {
    year: 2026 as const,
    coordinationStage: 2 as const,
    modelVersion: modelData.model.version,
    modelMode: "normalized_percentage" as const,
    score,
    maxScore,
    percentage,
    educationSystem,
    branch,
    branchSource,
    governorate: governorate ?? null,
  };

  if (!eligible) {
    return {
      ...baseReport,
      eligibility: {
        eligible: false,
        status: "not_eligible_current_stage",
        minimumScore: rule.minimumScore,
        minimumPercentage: rule.minimumPercentage,
        message:
          "مجموعك أقل من الحد الأدنى المعلن للمرحلة الثانية حاليًا. هنحدّث الخيارات بعد إعلان بيانات المرحلة الثالثة.",
      },
      confidence: "منخفضة",
      recommendations: [],
      officialClosedFacts: [],
      unavailableCount: 0,
      unknownCount: 0,
      disclaimer:
        "التوقعات تحليل إحصائي وليست نتيجة تنسيق رسمية أو ضمانًا للقبول.",
    };
  }

  if (educationSystem === "old") {
    return {
      ...baseReport,
      eligibility: {
        eligible: true,
        status: "availability_unknown",
        minimumScore: rule.minimumScore,
        minimumPercentage: rule.minimumPercentage,
        message:
          "أنت داخل الحد المعلن للمرحلة الثانية، لكن بيانات الكليات بالنظام القديم غير مكتملة بما يكفي لتوقع آمن.",
      },
      confidence: "منخفضة",
      recommendations: [],
      officialClosedFacts: [],
      unavailableCount: 0,
      unknownCount: 1,
      disclaimer:
        "لا نعرض توقعات عند غياب بيانات موثوقة. المرجع النهائي هو موقع التنسيق الإلكتروني.",
    };
  }

  const vacancies = modelData.stageVacancies.filter(
    (item) => item.educationSystem === educationSystem && item.branch === branch,
  );
  const vacancyKeys = new Set(vacancies.map((item) => item.facultyKey));
  const shifts = calibrationShifts(branch, modelData, historyRows);
  const recommendations: Stage2Recommendation[] = [];
  let unknownCount = 0;

  for (const vacancy of vacancies) {
    const history = historyFor(vacancy, historyRows);
    const baseline = historicalBaseline(history, modelData.model.historicalWeights);
    if (baseline == null) {
      unknownCount += 1;
      continue;
    }
    const values = [...history.values()];
    const center = median(values);
    const mad = median(values.map((value) => Math.abs(value - center)));
    const missingYears = 3 - history.size;
    const uncertainty = Math.max(modelData.model.minimumUncertainty ?? 0.65, 1.4826 * mad, 0.9) +
      missingYears * 0.35 +
      0.35;
    const trend =
      history.has(2025) && history.has(2023)
        ? ((history.get(2025)! - history.get(2023)!) / 2) * 0.2
        : 0;
    const predicted = Math.min(
      100,
      Math.max(0, baseline + (shifts.get(sector(vacancy.officialNameArabic)) ?? 0) + trend),
    );
    const margin = percentage - predicted;
    const category = classify(margin, uncertainty, modelData.model.classificationBoundaries);
    const governorateName = inferGovernorate(vacancy.officialNameArabic);
    const proximityTier = getProximityTier(governorate, governorateName ?? "");
    const historicalCutoffs = Object.fromEntries(
      [...history].map(([year, value]) => [year, round(value)]),
    ) as Stage2Recommendation["historicalCutoffs"];
    const confidence: PredictionConfidence =
      history.size === 3 && uncertainty <= 1.5 ? "متوسطة" : "منخفضة";
    recommendations.push({
      id: `${vacancy.branch}:${vacancy.facultyKey}`,
      officialNameArabic: vacancy.officialNameArabic,
      facultyKey: vacancy.facultyKey,
      branch,
      status: "available_stage_2",
      predictedCutoffPercentage: round(predicted),
      expectedRange: [
        round(Math.max(0, predicted - uncertainty)),
        round(Math.min(100, predicted + uncertainty)),
      ],
      uncertainty: round(uncertainty),
      category,
      confidence,
      difference: round(margin),
      historicalCutoffs,
      requiresAptitudeTest: vacancy.requiresAptitudeTest,
      governorate: governorateName,
      proximityTier,
      proximityLabel: proximityLabels[proximityTier],
      explanation: recommendationExplanation(
        category,
        uncertainty,
        vacancy.requiresAptitudeTest,
      ),
    });
  }

  recommendations.sort(
    (a, b) =>
      categoryOrder[a.category] - categoryOrder[b.category] ||
      proximityRank(a.proximityTier) - proximityRank(b.proximityTier) ||
      Math.abs(a.difference) - Math.abs(b.difference) ||
      b.predictedCutoffPercentage - a.predictedCutoffPercentage,
  );

  const closedFacts = modelData.officialCutoffs
    .filter(
      (item) =>
        item.educationSystem === educationSystem &&
        item.branch === branch &&
        !vacancyKeys.has(item.facultyKey),
    )
    .map((item) => ({
      id: `${item.branch}:${item.facultyKey}`,
      officialNameArabic: item.officialNameArabic,
      status: "officially_closed_stage_1" as const,
      score: item.score,
      maximumScore: item.maximumScore,
      percentage: item.percentage,
    }));

  const confidence: PredictionConfidence = recommendations.some(
    (item) => item.confidence === "متوسطة",
  )
    ? "متوسطة"
    : "منخفضة";

  return {
    ...baseReport,
    eligibility: {
      eligible: true,
      status: "available_stage_2",
      minimumScore: rule.minimumScore,
      minimumPercentage: rule.minimumPercentage,
      message: "مجموعك داخل الحد الأدنى المعلن للتسجيل في المرحلة الثانية.",
    },
    confidence,
    recommendations,
    officialClosedFacts: closedFacts,
    unavailableCount: closedFacts.length,
    unknownCount,
    disclaimer:
      "التوقعات المعروضة تحليل إحصائي وليست نتيجة تنسيق رسمية أو ضمانًا للقبول. المرجع النهائي هو موقع التنسيق الإلكتروني ووزارة التعليم العالي.",
  };
}

export function toFreeStage2Report(
  report: Stage2Report,
  freeRecommendationCount: number,
): FreeStage2Report {
  const count = Math.max(1, Math.min(10, Math.trunc(freeRecommendationCount)));
  const recommendations = report.recommendations.slice(0, count);
  return {
    ...report,
    recommendations,
    lockedRecommendationCount: Math.max(
      0,
      report.recommendations.length - recommendations.length,
    ),
    totalRecommendationCount: report.recommendations.length,
    premium: false,
  };
}

export function getStage2Seed() {
  return seed;
}

export function getOfficialStage1Fact(
  officialNameArabic: string,
  branch: Branch,
) {
  const normalized = normalizeArabicName(officialNameArabic);
  return (seed.officialCutoffs as OfficialCutoff[]).find(
    (item) =>
      item.branch === branch &&
      normalizeArabicName(item.officialNameArabic) === normalized,
  );
}

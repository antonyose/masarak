import predictionV2Json from "@/lib/coordination-data/prediction-v2-2026.json";
import stage3Json from "@/lib/coordination-data/stage3-2026.json";
import type { Branch, EducationSystem } from "@/lib/grade-scales";
import { getProximityTier, proximityLabels, proximityRank } from "@/lib/governorates";
import { getPredictionV2RuntimeContextForTests, robustRecentLevel } from "@/lib/prediction-v2/model";
import type { FitSignal, InternalConfidence, PredictionV2Seed } from "@/lib/prediction-v2/types";
import type { Stage3Recommendation, Stage3Report, Stage3Seed } from "@/lib/prediction-stage3/types";

const baseSeed = predictionV2Json as unknown as PredictionV2Seed;
const defaultSeed = stage3Json as unknown as Stage3Seed;

const fitLabels = {
  green: "مناسب جدًا",
  yellow: "فرصة جيدة",
  orange: "اختيار طموح",
  red: "بعيد عن مجموعك",
} as const;
const fitRank: Record<FitSignal, number> = { green: 0, yellow: 1, orange: 2, red: 3 };
const confidenceRank: Record<InternalConfidence, number> = { high: 0, medium: 1, low: 2 };

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function priorHistory(history: Map<number, number>) {
  return new Map([...history].filter(([year]) => year < 2026));
}

function basePrediction(history: Map<number, number>, sectorPrior: number | null) {
  const prior = priorHistory(history);
  const level = robustRecentLevel(prior, 2026);
  if (level == null) return null;
  if (prior.size >= 3 || sectorPrior == null) return level;
  const weight = prior.size / (prior.size + baseSeed.model.sparseShrinkagePrior);
  return level * weight + sectorPrior * (1 - weight);
}

function intervalWidth(history: Map<number, number>, empiricalP80: number, minimum: number) {
  const values = [...priorHistory(history).values()];
  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center))) * 1.4826;
  return Math.max(minimum, empiricalP80 || 0, mad) + Math.max(0, 3 - values.length) * 0.35;
}

function fitFor(percentage: number, predicted: number, halfWidth: number): FitSignal {
  if (percentage >= predicted + halfWidth) return "green";
  if (percentage >= predicted) return "yellow";
  if (percentage >= predicted - halfWidth) return "orange";
  return "red";
}

function confidenceFor(history: Map<number, number>, halfWidth: number): InternalConfidence {
  const count = priorHistory(history).size;
  if (count >= 4 && halfWidth <= 3) return "high";
  if (count >= 3 && halfWidth <= 4.5) return "medium";
  return "low";
}

export function calculateStage3Prediction({
  score,
  maxScore,
  percentage,
  educationSystem,
  branch,
  governorate,
  premium = true,
  seed = defaultSeed,
}: {
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  governorate?: string;
  premium?: boolean;
  seed?: Stage3Seed;
}): Stage3Report {
  const rule = seed.stageRules.find((candidate) => candidate.educationSystem === educationSystem && candidate.branch === branch);
  if (!rule) throw new Error("NO_STAGE3_RULE");
  const eligible = score >= rule.minimumScore;
  const branchOfficialVacancies = educationSystem === "new"
    ? seed.stage3Vacancies.filter((row) => row.branch === branch)
    : [];
  const officialVacancies = eligible ? branchOfficialVacancies : [];
  const context = getPredictionV2RuntimeContextForTests(baseSeed);
  const sectorValues = new Map<string, number[]>();
  for (const [optionId, history] of context.histories) {
    const option = context.options.get(optionId);
    if (!option || option.branch !== branch) continue;
    const level = robustRecentLevel(history, 2026);
    if (level == null) continue;
    sectorValues.set(option.sector, [...(sectorValues.get(option.sector) ?? []), level]);
  }
  const sectorPriors = new Map([...sectorValues].map(([sector, values]) => [sector, median(values)]));
  const modeled: Stage3Recommendation[] = [];

  for (const vacancy of officialVacancies) {
    const option = context.options.get(vacancy.admissionOptionId);
    const history = context.histories.get(vacancy.admissionOptionId);
    if (!option || !history) continue;
    const base = basePrediction(history, sectorPriors.get(option.sector) ?? null);
    if (base == null) continue;
    const calibration = seed.calibrationCells[`${branch}:${option.sector}`];
    const adjustment = calibration?.adjustment ?? 0;
    const predicted = Math.max(0, Math.min(100, base + adjustment));
    const halfWidth = intervalWidth(history, calibration?.residualP80 ?? 0, seed.model.minimumIntervalHalfWidth);
    const fit = fitFor(percentage, predicted, halfWidth);
    const confidence = confidenceFor(history, halfWidth);
    const proximityTier = getProximityTier(governorate, option.governorate ?? "");
    const condition = vacancy.requiresAptitudeTest
      ? "يتطلب اجتياز اختبار القدرات وفق القواعد الرسمية"
      : vacancy.requiresGenderCheck
        ? "متاح بشرط انطباق قيد النوع المعلن على الكلية"
        : null;
    modeled.push({
      id: vacancy.id,
      admissionOptionId: option.id,
      officialNameArabic: vacancy.officialNameArabic,
      branch,
      availability: "listed_stage_3",
      availabilityLabel: "متاح في المرحلة الثالثة",
      institutionClass: vacancy.institutionClass,
      predictedCutoffPercentage: round(predicted),
      expectedRange: [round(Math.max(0, predicted - halfWidth)), round(Math.min(100, predicted + halfWidth))],
      intervalHalfWidth: round(halfWidth),
      fit,
      fitLabel: fitLabels[fit],
      internalConfidence: confidence,
      difference: round(percentage - predicted),
      history: Object.fromEntries([...priorHistory(history)].map(([year, value]) => [year, round(value)])),
      requiresAptitudeTest: vacancy.requiresAptitudeTest,
      requiresGenderCheck: vacancy.requiresGenderCheck,
      eligibilityCondition: condition,
      governorate: option.governorate,
      proximityTier,
      proximityLabel: proximityLabels[proximityTier],
      modelReasons: [
        "official_stage3_vacancy",
        "robust_2021_2025_level",
        "stage2_2026_hierarchical_calibration",
        "empirical_uncertainty_interval",
      ],
    });
  }

  modeled.sort((a, b) => {
    const aBucket = Math.floor(Math.abs(a.difference) / seed.model.relevanceBucketWidth);
    const bBucket = Math.floor(Math.abs(b.difference) / seed.model.relevanceBucketWidth);
    return fitRank[a.fit] - fitRank[b.fit]
      || aBucket - bBucket
      || proximityRank(a.proximityTier) - proximityRank(b.proximityTier)
      || Math.abs(a.difference) - Math.abs(b.difference)
      || confidenceRank[a.internalConfidence] - confidenceRank[b.internalConfidence]
      || a.admissionOptionId.localeCompare(b.admissionOptionId);
  });
  const conditional = modeled.filter((row) => row.eligibilityCondition);
  const normal = modeled.filter((row) => !row.eligibilityCondition);
  const closest = normal.filter((row) => row.fit === "green" || row.fit === "yellow");
  const ambitious = normal.filter((row) => row.fit === "orange");
  const red = normal.filter((row) => row.fit === "red");
  const limits = premium
    ? seed.model
    : { ...seed.model, closestDisplayCap: 3, ambitiousDisplayCap: 1, redDisplayCap: 0, conditionalDisplayCap: 0 };
  const closestItems = closest.slice(0, limits.closestDisplayCap);
  const ambitiousItems = ambitious.slice(0, limits.ambitiousDisplayCap);
  const redItems = red.slice(0, limits.redDisplayCap);
  const conditionalItems = conditional.slice(0, limits.conditionalDisplayCap);
  const visible = [...closestItems, ...ambitiousItems, ...redItems];

  return {
    schemaVersion: "stage3-report@1",
    coordinationStage: 3,
    modelVersion: "stage3-2026-v1",
    modelMode: "normalized_percentage",
    dataHash: seed.dataHash,
    score,
    maxScore,
    percentage,
    educationSystem,
    branch,
    governorate: governorate ?? null,
    availabilityStatus: rule.officialVacancyArtifactAvailable ? "official" : "official_list_unavailable_for_old_system",
    availabilityLabel: rule.officialVacancyArtifactAvailable
      ? "كل الخيارات المعروضة متاحة رسميًا في المرحلة الثالثة"
      : "لم نعثر على قائمة شواغر رسمية منفصلة للنظام القديم؛ لن نخمن الإتاحة",
    registration: { minimumScore: rule.minimumScore, minimumPercentage: rule.minimumPercentage, eligible },
    groups: {
      closest: { items: closestItems, hiddenCount: Math.max(0, closest.length - closestItems.length) },
      ambitious: { items: ambitiousItems, hiddenCount: Math.max(0, ambitious.length - ambitiousItems.length) },
      higherThanScore: { items: redItems, hiddenCount: Math.max(0, red.length - redItems.length), collapsed: true },
      conditional: { items: conditionalItems, hiddenCount: Math.max(0, conditional.length - conditionalItems.length) },
    },
    recommendations: visible,
    conditionalRecommendations: conditionalItems,
    totalRecommendationCount: normal.length + conditional.length,
    lockedRecommendationCount: premium ? 0 : Math.max(0, normal.length + conditional.length - visible.length),
    premium,
    disclaimers: [
      "الإتاحة رسمية، لكن الحد النهائي للمرحلة الثالثة ما زال تقديرًا وليس ضمان قبول.",
      "ترتيب القرب للمساعدة فقط؛ قواعد التوزيع الجغرافي الرسمية لها الأولوية عند كتابة الرغبات.",
      "راجع موقع التنسيق ووزارة التعليم العالي قبل تسجيل الرغبات.",
    ],
    diagnostics: {
      officialVacancies: branchOfficialVacancies.length,
      modeledCandidates: modeled.length,
      conditionalCandidates: conditional.length,
      fitCounts: {
        green: modeled.filter((row) => row.fit === "green").length,
        yellow: modeled.filter((row) => row.fit === "yellow").length,
        orange: modeled.filter((row) => row.fit === "orange").length,
        red: modeled.filter((row) => row.fit === "red").length,
      },
    },
  };
}

export function isStage3Report(value: unknown): value is Stage3Report {
  return Boolean(value && typeof value === "object" && (value as { schemaVersion?: string }).schemaVersion === "stage3-report@1");
}

export function toFreeStage3Report(report: Stage3Report, freeRecommendationCount: number): Stage3Report {
  const ordered = [
    ...report.groups.closest.items,
    ...report.groups.ambitious.items,
    ...report.groups.higherThanScore.items,
    ...report.groups.conditional.items,
  ];
  const allowed = new Set(ordered.slice(0, Math.max(0, freeRecommendationCount)).map((row) => row.id));
  const keep = (items: Stage3Recommendation[]) => items.filter((row) => allowed.has(row.id));
  const visible = keep(report.recommendations);
  return {
    ...report,
    premium: false,
    recommendations: visible,
    conditionalRecommendations: keep(report.conditionalRecommendations),
    groups: {
      closest: { items: keep(report.groups.closest.items), hiddenCount: 0 },
      ambitious: { items: keep(report.groups.ambitious.items), hiddenCount: 0 },
      higherThanScore: { items: keep(report.groups.higherThanScore.items), hiddenCount: 0, collapsed: true },
      conditional: { items: keep(report.groups.conditional.items), hiddenCount: 0 },
    },
    lockedRecommendationCount: Math.max(0, report.totalRecommendationCount - allowed.size),
  };
}

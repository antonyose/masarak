import predictionV2SeedJson from "@/lib/coordination-data/prediction-v2-2026.json";
import type { Branch, EducationSystem } from "@/lib/grade-scales";
import {
  getProximityTier,
  proximityLabels,
  proximityRank,
} from "@/lib/governorates";
import { isPublicCoreClass } from "@/lib/prediction-v2/catalog";
import type {
  AdmissionOptionV2,
  FitSignal,
  HistoricalObservationV2,
  InternalConfidence,
  PredictionV2Recommendation,
  PredictionV2Report,
  PredictionV2Seed,
  Stage3ForecastV2,
} from "@/lib/prediction-v2/types";

const defaultSeed = predictionV2SeedJson as unknown as PredictionV2Seed;

type HistoryMap = Map<number, number>;
type RuntimeContext = {
  options: Map<string, AdmissionOptionV2>;
  histories: Map<string, HistoryMap>;
  residualsByBranch: Map<Branch, number[]>;
  residualsByCell: Map<string, number[]>;
  calibrationByCell: Map<string, { sampleSize: number; adjustment: number }>;
};

const contextCache = new WeakMap<object, RuntimeContext>();

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

function quantile(values: number[], probability: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function historyBefore(history: HistoryMap, year: number) {
  return new Map([...history].filter(([candidateYear]) => candidateYear < year));
}

/**
 * Robust recent-level estimator. It deliberately contains no trend term.
 * The two most recent years receive explicit weights and older evidence is
 * collapsed to one robust median so five years are never flat-averaged.
 */
export function robustRecentLevel(history: HistoryMap, predictionYear = 2026) {
  const prior = [...history]
    .filter(([year]) => year < predictionYear)
    .sort(([a], [b]) => b - a);
  if (!prior.length) return null;
  const latest = prior[0];
  const previous = prior[1];
  const older = prior.slice(2).map(([, value]) => value);
  const parts: Array<{ value: number; weight: number }> = [];
  if (latest) parts.push({ value: latest[1], weight: 0.55 });
  if (previous) parts.push({ value: previous[1], weight: 0.3 });
  if (older.length) parts.push({ value: median(older), weight: 0.15 });
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  return parts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight;
}

function collectHistories(seed: PredictionV2Seed) {
  const values = new Map<string, Map<number, number[]>>();
  for (const row of seed.historicalObservations) {
    if (
      row.resolutionStatus !== "resolved" ||
      !row.admissionOptionId ||
      !isPublicCoreClass(row.institutionClass)
    ) continue;
    const byYear = values.get(row.admissionOptionId) ?? new Map<number, number[]>();
    const yearValues = byYear.get(row.year) ?? [];
    yearValues.push(row.minimumPercentage);
    byYear.set(row.year, yearValues);
    values.set(row.admissionOptionId, byYear);
  }
  return new Map(
    [...values].map(([optionId, years]) => [
      optionId,
      new Map([...years].map(([year, yearValues]) => [year, median(yearValues)])),
    ]),
  );
}

function sectorPriors({
  seed,
  histories,
  branch,
  predictionYear,
}: {
  seed: PredictionV2Seed;
  histories: Map<string, HistoryMap>;
  branch: Branch;
  predictionYear: number;
}) {
  const options = new Map(seed.admissionOptions.map((option) => [option.id, option]));
  const grouped = new Map<string, number[]>();
  for (const [optionId, history] of histories) {
    const option = options.get(optionId);
    if (!option || option.branch !== branch) continue;
    const value = robustRecentLevel(history, predictionYear);
    if (value == null) continue;
    const values = grouped.get(option.sector) ?? [];
    values.push(value);
    grouped.set(option.sector, values);
  }
  return new Map([...grouped].map(([sector, values]) => [sector, median(values)]));
}

function basePrediction({
  history,
  sectorPrior,
  predictionYear,
  sparsePrior,
}: {
  history: HistoryMap;
  sectorPrior: number | null;
  predictionYear: number;
  sparsePrior: number;
}) {
  const priorHistory = historyBefore(history, predictionYear);
  const level = robustRecentLevel(priorHistory, predictionYear);
  if (level == null) return null;
  if (priorHistory.size >= 3 || sectorPrior == null) return level;
  const optionWeight = priorHistory.size / (priorHistory.size + sparsePrior);
  return level * optionWeight + sectorPrior * (1 - optionWeight);
}

function buildResidualProfiles(
  seed: PredictionV2Seed,
  histories: Map<string, HistoryMap>,
  years: number[] = [2025],
) {
  const options = new Map(seed.admissionOptions.map((option) => [option.id, option]));
  const byBranch = new Map<Branch, number[]>();
  const byCell = new Map<string, number[]>();
  for (const year of years) {
    for (const branch of ["science", "mathematics", "literary"] as const) {
      const priors = sectorPriors({ seed, histories, branch, predictionYear: year });
      for (const [optionId, history] of histories) {
        const option = options.get(optionId);
        const actual = history.get(year);
        if (!option || option.branch !== branch || actual == null || historyBefore(history, year).size < 2) continue;
        const predicted = basePrediction({
          history,
          sectorPrior: priors.get(option.sector) ?? null,
          predictionYear: year,
          sparsePrior: seed.model.sparseShrinkagePrior,
        });
        if (predicted == null) continue;
        const absoluteError = Math.abs(actual - predicted);
        const branchValues = byBranch.get(branch) ?? [];
        branchValues.push(absoluteError);
        byBranch.set(branch, branchValues);
        const cell = `${branch}:${option.sector}`;
        const cellValues = byCell.get(cell) ?? [];
        cellValues.push(absoluteError);
        byCell.set(cell, cellValues);
      }
    }
  }
  return { byBranch, byCell };
}

function buildCalibrationProfiles(
  seed: PredictionV2Seed,
  histories: Map<string, HistoryMap>,
) {
  const options = new Map(seed.admissionOptions.map((option) => [option.id, option]));
  const sectorPriorsByBranch = new Map(
    (["science", "mathematics", "literary"] as const).map((branch) => [
      branch,
      sectorPriors({ seed, histories, branch, predictionYear: 2026 }),
    ]),
  );
  const residuals = new Map<string, number[]>();
  for (const cutoff of seed.officialCutoffs) {
    if (cutoff.resolutionStatus !== "resolved" || !cutoff.admissionOptionId) continue;
    const option = options.get(cutoff.admissionOptionId);
    const history = histories.get(cutoff.admissionOptionId);
    if (!option || !history) continue;
    const predicted = basePrediction({
      history,
      sectorPrior: sectorPriorsByBranch.get(cutoff.branch)?.get(option.sector) ?? null,
      predictionYear: 2026,
      sparsePrior: seed.model.sparseShrinkagePrior,
    });
    if (predicted == null) continue;
    const cell = `${cutoff.branch}:${option.sector}`;
    const values = residuals.get(cell) ?? [];
    values.push(cutoff.minimumPercentage - predicted);
    residuals.set(cell, values);
  }
  return new Map(
    [...residuals].map(([cell, values]) => {
      const weight = values.length / (values.length + seed.model.calibrationShrinkagePrior);
      return [cell, { sampleSize: values.length, adjustment: median(values) * weight }];
    }),
  );
}

function runtimeContext(seed: PredictionV2Seed): RuntimeContext {
  const cached = contextCache.get(seed as unknown as object);
  if (cached) return cached;
  const histories = collectHistories(seed);
  const residuals = buildResidualProfiles(seed, histories);
  const context = {
    options: new Map(seed.admissionOptions.map((option) => [option.id, option])),
    histories,
    residualsByBranch: residuals.byBranch,
    residualsByCell: residuals.byCell,
    calibrationByCell: buildCalibrationProfiles(seed, histories),
  };
  contextCache.set(seed as unknown as object, context);
  return context;
}

function intervalHalfWidth({
  seed,
  context,
  branch,
  sector,
  history,
}: {
  seed: PredictionV2Seed;
  context: RuntimeContext;
  branch: Branch;
  sector: string;
  history: HistoryMap;
}) {
  const branchResiduals = context.residualsByBranch.get(branch) ?? [];
  const cellResiduals = context.residualsByCell.get(`${branch}:${sector}`) ?? [];
  const branchP80 = quantile(branchResiduals, 0.8);
  const empirical = cellResiduals.length >= 10
    ? branchP80 * 0.35 + quantile(cellResiduals, 0.8) * 0.65
    : branchP80;
  const values = [...historyBefore(history, 2026).values()];
  const center = median(values);
  const robustDispersion = median(values.map((value) => Math.abs(value - center))) * 1.4826;
  const evidencePenalty = Math.max(0, 3 - values.length) * 0.35;
  return Math.max(seed.model.minimumIntervalHalfWidth, empirical, robustDispersion) + evidencePenalty;
}

function fitForScore(percentage: number, predicted: number, halfWidth: number): FitSignal {
  const lower = predicted - halfWidth;
  const upper = predicted + halfWidth;
  if (percentage >= upper) return "green";
  if (percentage >= predicted) return "yellow";
  if (percentage >= lower) return "orange";
  return "red";
}

const fitLabels = {
  green: "مناسب جدًا",
  yellow: "فرصة جيدة",
  orange: "اختيار طموح",
  red: "بعيد عن مجموعك",
} as const;

const fitRank: Record<FitSignal, number> = { green: 0, yellow: 1, orange: 2, red: 3 };
const confidenceRank: Record<InternalConfidence, number> = { high: 0, medium: 1, low: 2 };

function confidenceFor(history: HistoryMap, halfWidth: number): InternalConfidence {
  const count = historyBefore(history, 2026).size;
  if (count >= 4 && halfWidth <= 3) return "high";
  if (count >= 3 && halfWidth <= 4.5) return "medium";
  return "low";
}

function sortRecommendations(
  recommendations: PredictionV2Recommendation[],
  relevanceBucketWidth: number,
) {
  return recommendations.sort((a, b) => {
    const fitGroup = (fit: FitSignal) => fit === "green" || fit === "yellow" ? 0 : fit === "orange" ? 1 : 2;
    const fitGroupDifference = fitGroup(a.fit) - fitGroup(b.fit);
    if (fitGroupDifference) return fitGroupDifference;
    const aBucket = Math.floor(Math.abs(a.difference) / relevanceBucketWidth);
    const bBucket = Math.floor(Math.abs(b.difference) / relevanceBucketWidth);
    return (
      aBucket - bBucket ||
      Math.abs(a.difference) - Math.abs(b.difference) ||
      fitRank[a.fit] - fitRank[b.fit] ||
      confidenceRank[a.internalConfidence] - confidenceRank[b.internalConfidence] ||
      proximityRank(a.proximityTier) - proximityRank(b.proximityTier) ||
      b.predictedCutoffPercentage - a.predictedCutoffPercentage ||
      a.admissionOptionId.localeCompare(b.admissionOptionId)
    );
  });
}

function stage3Forecasts({
  seed,
  context,
  branch,
  percentage,
  governorate,
  aptitudeTestPassed,
  currentVacancyIds,
  closedIds,
}: {
  seed: PredictionV2Seed;
  context: RuntimeContext;
  branch: Branch;
  percentage: number;
  governorate?: string;
  aptitudeTestPassed?: boolean;
  currentVacancyIds: Set<string>;
  closedIds: Set<string>;
}) {
  const priors = sectorPriors({ seed, histories: context.histories, branch, predictionYear: 2026 });
  const forecasts: Stage3ForecastV2[] = [];
  for (const option of seed.admissionOptions) {
    if (
      option.branch !== branch ||
      currentVacancyIds.has(option.id) ||
      closedIds.has(option.id) ||
      (option.requiresAptitudeTest && aptitudeTestPassed !== true)
    ) continue;
    const history = context.histories.get(option.id);
    if (!history || historyBefore(history, 2026).size < 3) continue;
    const predicted = basePrediction({
      history,
      sectorPrior: priors.get(option.sector) ?? null,
      predictionYear: 2026,
      sparsePrior: seed.model.sparseShrinkagePrior,
    });
    if (predicted == null || predicted > Math.max(72, percentage + 5)) continue;
    const halfWidth = intervalHalfWidth({ seed, context, branch, sector: option.sector, history });
    const confidence = confidenceFor(history, halfWidth);
    forecasts.push({
      id: `stage3:${option.id}`,
      admissionOptionId: option.id,
      officialNameArabic: option.canonicalNameArabic,
      branch,
      availability: "forecast_stage_3",
      availabilityLabel: "متوقع يظهر في المرحلة الثالثة",
      predictedCutoffPercentage: round(predicted),
      expectedRange: [round(Math.max(0, predicted - halfWidth)), round(Math.min(100, predicted + halfWidth))],
      internalConfidence: confidence,
      limitedDataWarning: confidence === "low" ? "البيانات التاريخية للكليّة دي محدودة" : null,
      requiresAptitudeTest: option.requiresAptitudeTest,
      governorate: option.governorate,
    });
  }
  return forecasts.sort((a, b) =>
    Math.abs(percentage - a.predictedCutoffPercentage) - Math.abs(percentage - b.predictedCutoffPercentage) ||
    proximityRank(getProximityTier(governorate, a.governorate ?? "")) - proximityRank(getProximityTier(governorate, b.governorate ?? "")) ||
    a.admissionOptionId.localeCompare(b.admissionOptionId),
  );
}

export function calculatePredictionV2({
  score,
  maxScore,
  percentage,
  educationSystem,
  branch,
  governorate,
  aptitudeTestPassed,
  seed = defaultSeed,
}: {
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  governorate?: string;
  aptitudeTestPassed?: boolean;
  seed?: PredictionV2Seed;
}): PredictionV2Report {
  const context = runtimeContext(seed);
  const rule = seed.stageRules.find((candidate) =>
    candidate.stage === 2 && candidate.educationSystem === educationSystem && candidate.branch === branch,
  );
  if (!rule) throw new Error("NO_V2_STAGE_RULE");
  const eligible = score >= rule.minimumScore;
  const rawPublicVacancies = seed.stageVacancies.filter((vacancy) =>
    vacancy.educationSystem === educationSystem &&
    vacancy.branch === branch &&
    isPublicCoreClass(vacancy.institutionClass),
  );
  const publicVacancies = [...new Map(rawPublicVacancies.map((vacancy) => [
    vacancy.admissionOptionId ? `option:${vacancy.admissionOptionId}` : `row:${vacancy.id}`,
    vacancy,
  ])).values()];
  const currentVacancyIds = new Set(
    publicVacancies
      .filter((vacancy) => vacancy.resolutionStatus === "resolved" && vacancy.admissionOptionId)
      .map((vacancy) => vacancy.admissionOptionId!),
  );
  const officialClosedFacts = seed.officialCutoffs.filter((cutoff) =>
    cutoff.educationSystem === educationSystem &&
    cutoff.branch === branch &&
    (!cutoff.admissionOptionId || !currentVacancyIds.has(cutoff.admissionOptionId)),
  );
  const closedIds = new Set(
    officialClosedFacts.flatMap((cutoff) => cutoff.admissionOptionId ? [cutoff.admissionOptionId] : []),
  );
  const forecastCandidates = stage3Forecasts({
    seed,
    context,
    branch,
    percentage,
    governorate,
    aptitudeTestPassed,
    currentVacancyIds,
    closedIds,
  });
  const visibleForecasts = forecastCandidates.slice(0, seed.model.stage3DisplayCap);

  if (!eligible || educationSystem !== "new") {
    const belowFloor = !eligible;
    return {
      schemaVersion: "prediction-v2-report@1",
      year: 2026,
      coordinationStage: 2,
      modelVersion: "stage2-2026-v2-shadow",
      shadow: true,
      modelMode: "normalized_percentage",
      score,
      maxScore,
      percentage,
      educationSystem,
      branch,
      governorate: governorate ?? null,
      eligibility: {
        eligible: false,
        status: belowFloor ? "below_stage_2_floor" : "availability_unknown",
        minimumScore: rule.minimumScore,
        minimumPercentage: rule.minimumPercentage,
        message: belowFloor
          ? "مجموعك أقل من حد تسجيل المرحلة الثانية؛ المعروض أدناه توقع منفصل للمرحلة الثالثة وليس إتاحة رسمية."
          : "بيانات الإتاحة الدقيقة لهذا النظام الدراسي غير مكتملة، لذلك لم نعرض ترشيحات مرحلة ثانية.",
      },
      groups: {
        closest: { items: [], hiddenCount: 0 },
        ambitious: { items: [], hiddenCount: 0 },
        stage3Forecast: { items: visibleForecasts, hiddenCount: Math.max(0, forecastCandidates.length - visibleForecasts.length) },
        higherThanScore: { items: [], hiddenCount: 0, collapsed: true },
      },
      recommendations: [],
      officialClosedFacts,
      coverageWarning: {
        active: true,
        code: belowFloor ? "BELOW_STAGE2_FLOOR" : "SYSTEM_AVAILABILITY_UNKNOWN",
        message: belowFloor
          ? "لا توجد اختيارات مرحلة ثانية صالحة لهذا المجموع. توقعات المرحلة الثالثة منفصلة وغير رسمية."
          : "لن نخمن إتاحة غير موثقة لهذا النظام.",
        reasons: belowFloor ? ["stage_floor"] : ["education_system_data"],
      },
      diagnostics: {
        candidateVacancies: publicVacancies.length,
        resolvedCandidates: currentVacancyIds.size,
        unresolvedCandidates: publicVacancies.filter((row) => row.resolutionStatus !== "resolved").length,
        modeledCandidates: 0,
        unmodeledCandidates: currentVacancyIds.size,
        aptitudeExcludedCandidates: 0,
        realisticOptions: 0,
        fitCounts: { green: 0, yellow: 0, orange: 0, red: 0 },
        sourceOfficialArtifact: seed.sources.filter((source) => source.key.startsWith("stage2-2026")).every((source) => source.officialArtifact),
      },
      disclaimer: "توقعات المرحلة الثالثة تحليل تاريخي منفصل وليست إعلان إتاحة أو ضمان قبول. المرجع النهائي هو موقع التنسيق ووزارة التعليم العالي.",
    };
  }

  const priors = sectorPriors({ seed, histories: context.histories, branch, predictionYear: 2026 });
  const recommendations: PredictionV2Recommendation[] = [];
  let unresolvedCandidates = 0;
  let unmodeledCandidates = 0;
  let aptitudeExcludedCandidates = 0;
  for (const vacancy of publicVacancies) {
    if (vacancy.resolutionStatus !== "resolved" || !vacancy.admissionOptionId) {
      unresolvedCandidates += 1;
      continue;
    }
    const option = context.options.get(vacancy.admissionOptionId);
    if (!option || option.branch !== branch || closedIds.has(option.id)) continue;
    if (option.requiresAptitudeTest && aptitudeTestPassed !== true) {
      aptitudeExcludedCandidates += 1;
      continue;
    }
    const history = context.histories.get(option.id);
    if (!history) {
      unmodeledCandidates += 1;
      continue;
    }
    const base = basePrediction({
      history,
      sectorPrior: priors.get(option.sector) ?? null,
      predictionYear: 2026,
      sparsePrior: seed.model.sparseShrinkagePrior,
    });
    if (base == null) {
      unmodeledCandidates += 1;
      continue;
    }
    const cell = `${branch}:${option.sector}`;
    const calibration = context.calibrationByCell.get(cell);
    const calibrationAllowed =
      seed.model.calibrationTransferGate === "passed" &&
      seed.model.calibrationEligibleCells.includes(cell) &&
      (calibration?.sampleSize ?? 0) >= seed.model.calibrationMinimumSample;
    const predicted = Math.min(100, Math.max(0, base + (calibrationAllowed ? calibration!.adjustment : 0)));
    const halfWidth = intervalHalfWidth({ seed, context, branch, sector: option.sector, history });
    const fit = fitForScore(percentage, predicted, halfWidth);
    const confidence = confidenceFor(history, halfWidth);
    const proximityTier = getProximityTier(governorate, option.governorate ?? "");
    recommendations.push({
      id: `${branch}:${option.id}`,
      admissionOptionId: option.id,
      officialNameArabic: vacancy.officialNameArabic,
      branch,
      availability: "listed_stage_2",
      institutionClass: option.institutionClass,
      predictedCutoffPercentage: round(predicted),
      expectedRange: [round(Math.max(0, predicted - halfWidth)), round(Math.min(100, predicted + halfWidth))],
      intervalHalfWidth: round(halfWidth),
      fit,
      fitLabel: fitLabels[fit],
      internalConfidence: confidence,
      limitedDataWarning: confidence === "low" ? "البيانات التاريخية للكليّة دي محدودة" : null,
      difference: round(percentage - predicted),
      history: Object.fromEntries([...historyBefore(history, 2026)].map(([year, value]) => [year, round(value)])),
      requiresAptitudeTest: option.requiresAptitudeTest,
      governorate: option.governorate,
      proximityTier,
      proximityLabel: proximityLabels[proximityTier],
      modelReasons: [
        "robust_recent_level",
        ...(historyBefore(history, 2026).size < 3 ? ["sparse_sector_shrinkage"] : []),
        "empirical_holdout_interval",
        ...(calibrationAllowed ? ["guarded_2026_calibration"] : ["same_year_calibration_blocked"]),
      ],
    });
  }

  sortRecommendations(recommendations, seed.model.relevanceBucketWidth);
  const realistic = recommendations.filter((row) => row.fit === "green" || row.fit === "yellow");
  const ambitious = recommendations.filter((row) => row.fit === "orange");
  const red = recommendations.filter((row) => row.fit === "red");
  const closestItems = realistic.slice(0, seed.model.closestDisplayCap);
  const ambitiousItems = ambitious.slice(0, seed.model.ambitiousDisplayCap);
  const redItems = red.slice(0, seed.model.redDisplayCap);
  const visibleRecommendations = [...closestItems, ...ambitiousItems, ...redItems];
  const fitCounts = {
    green: recommendations.filter((row) => row.fit === "green").length,
    yellow: recommendations.filter((row) => row.fit === "yellow").length,
    orange: ambitious.length,
    red: red.length,
  };
  const sourceOfficialArtifact = seed.sources
    .filter((source) => source.key.startsWith("stage2-2026"))
    .every((source) => source.officialArtifact);
  const coverageReasons = [
    ...(realistic.length < 3 ? ["fewer_than_three_realistic_options"] : []),
    ...(recommendations.length > 0 && red.length / recommendations.length > 0.7 ? ["red_share_above_70_percent"] : []),
    ...(unresolvedCandidates > 0 ? ["unresolved_current_aliases"] : []),
    ...(unmodeledCandidates > 0 && (unmodeledCandidates / Math.max(1, publicVacancies.length) > 0.1 || realistic.length < 3)
      ? ["missing_exact_history"]
      : []),
    ...(!sourceOfficialArtifact ? ["official_stage2_artifact_not_reconciled"] : []),
  ];

  return {
    schemaVersion: "prediction-v2-report@1",
    year: 2026,
    coordinationStage: 2,
    modelVersion: "stage2-2026-v2-shadow",
    shadow: true,
    modelMode: "normalized_percentage",
    score,
    maxScore,
    percentage,
    educationSystem,
    branch,
    governorate: governorate ?? null,
    eligibility: {
      eligible: true,
      status: "eligible_stage_2",
      minimumScore: rule.minimumScore,
      minimumPercentage: rule.minimumPercentage,
      message: "مجموعك داخل حد التسجيل، والترشيحات مقيدة بقائمة المرحلة الثانية الحالية فقط.",
    },
    groups: {
      closest: { items: closestItems, hiddenCount: Math.max(0, realistic.length - closestItems.length) },
      ambitious: { items: ambitiousItems, hiddenCount: Math.max(0, ambitious.length - ambitiousItems.length) },
      stage3Forecast: { items: visibleForecasts, hiddenCount: Math.max(0, forecastCandidates.length - visibleForecasts.length) },
      higherThanScore: { items: redItems, hiddenCount: Math.max(0, red.length - redItems.length), collapsed: true },
    },
    recommendations: visibleRecommendations,
    officialClosedFacts,
    coverageWarning: {
      active: coverageReasons.length > 0,
      code: coverageReasons.length ? "COVERAGE_REVIEW_REQUIRED" : "OK",
      message: coverageReasons.length
        ? realistic.length < 3
          ? "التغطية الحالية لا تسمح بعرض خيارات جيدة بشكل كافٍ؛ لم نضف اختيارات مصطنعة."
          : "الخيارات الواقعية موجودة، لكن مصدر الإتاحة أو بعض بيانات المطابقة ما زالت تحتاج مراجعة قبل التفعيل."
        : "التغطية الواقعية كافية لهذا النطاق.",
      reasons: coverageReasons,
    },
    diagnostics: {
      candidateVacancies: publicVacancies.length,
      resolvedCandidates: currentVacancyIds.size,
      unresolvedCandidates,
      modeledCandidates: recommendations.length,
      unmodeledCandidates,
      aptitudeExcludedCandidates,
      realisticOptions: realistic.length,
      fitCounts,
      sourceOfficialArtifact,
    },
    disclaimer: "هذه توقعات إحصائية وليست نتيجة تنسيق رسمية أو ضمان قبول. الإتاحة النهائية وشروط القدرات يحددها موقع التنسيق ووزارة التعليم العالي.",
  };
}

export function getPredictionV2Seed() {
  return defaultSeed;
}

export function getPredictionV2RuntimeContextForTests(seed = defaultSeed) {
  return runtimeContext(seed);
}

export type PredictionV2EvaluationRow = {
  id: string;
  year: number;
  branch: Branch;
  sector: string;
  actual: number;
  predicted: number;
  intervalHalfWidth: number;
};

function rollingIntervalHalfWidth({
  seed,
  residuals,
  branch,
  sector,
  history,
  targetYear,
}: {
  seed: PredictionV2Seed;
  residuals: ReturnType<typeof buildResidualProfiles>;
  branch: Branch;
  sector: string;
  history: HistoryMap;
  targetYear: number;
}) {
  const branchValues = residuals.byBranch.get(branch) ?? [];
  const cellValues = residuals.byCell.get(`${branch}:${sector}`) ?? [];
  const branchP80 = quantile(branchValues, 0.8);
  const empirical = cellValues.length >= 10
    ? branchP80 * 0.35 + quantile(cellValues, 0.8) * 0.65
    : branchP80;
  const values = [...historyBefore(history, targetYear).values()];
  const center = median(values);
  const dispersion = median(values.map((value) => Math.abs(value - center))) * 1.4826;
  const evidencePenalty = Math.max(0, 3 - values.length) * 0.35;
  return Math.max(seed.model.minimumIntervalHalfWidth, empirical, dispersion) + evidencePenalty;
}

/** Rolling-origin evaluation. No observation from targetYear or later is used. */
export function evaluatePredictionV2Holdout(
  targetYear: 2024 | 2025,
  seed = defaultSeed,
): PredictionV2EvaluationRow[] {
  const context = runtimeContext(seed);
  const residualYears = Array.from(
    { length: Math.max(0, targetYear - 2023) },
    (_unused, index) => 2023 + index,
  );
  const rollingResiduals = buildResidualProfiles(seed, context.histories, residualYears);
  const rows: PredictionV2EvaluationRow[] = [];
  for (const branch of ["science", "mathematics", "literary"] as const) {
    const priors = sectorPriors({ seed, histories: context.histories, branch, predictionYear: targetYear });
    for (const [optionId, history] of context.histories) {
      const option = context.options.get(optionId);
      const actual = history.get(targetYear);
      if (!option || option.branch !== branch || actual == null || historyBefore(history, targetYear).size < 2) continue;
      const predicted = basePrediction({
        history,
        sectorPrior: priors.get(option.sector) ?? null,
        predictionYear: targetYear,
        sparsePrior: seed.model.sparseShrinkagePrior,
      });
      if (predicted == null) continue;
      rows.push({
        id: `${targetYear}:${optionId}`,
        year: targetYear,
        branch,
        sector: option.sector,
        actual,
        predicted,
        intervalHalfWidth: rollingIntervalHalfWidth({
          seed,
          residuals: rollingResiduals,
          branch,
          sector: option.sector,
          history,
          targetYear,
        }),
      });
    }
  }
  return rows;
}

export function evaluatePredictionV2Stage1_2026(
  seed = defaultSeed,
): PredictionV2EvaluationRow[] {
  const context = runtimeContext(seed);
  const priorsByBranch = new Map(
    (["science", "mathematics", "literary"] as const).map((branch) => [
      branch,
      sectorPriors({ seed, histories: context.histories, branch, predictionYear: 2026 }),
    ]),
  );
  const rows: PredictionV2EvaluationRow[] = [];
  for (const cutoff of seed.officialCutoffs) {
    if (cutoff.resolutionStatus !== "resolved" || !cutoff.admissionOptionId) continue;
    const option = context.options.get(cutoff.admissionOptionId);
    const history = context.histories.get(cutoff.admissionOptionId);
    if (!option || !history || historyBefore(history, 2026).size < 2) continue;
    const predicted = basePrediction({
      history,
      sectorPrior: priorsByBranch.get(cutoff.branch)?.get(option.sector) ?? null,
      predictionYear: 2026,
      sparsePrior: seed.model.sparseShrinkagePrior,
    });
    if (predicted == null) continue;
    rows.push({
      id: cutoff.id,
      year: 2026,
      branch: cutoff.branch,
      sector: option.sector,
      actual: cutoff.minimumPercentage,
      predicted,
      intervalHalfWidth: intervalHalfWidth({
        seed,
        context,
        branch: cutoff.branch,
        sector: option.sector,
        history,
      }),
    });
  }
  return rows;
}

export function observationsForOption(
  optionId: string,
  seed = defaultSeed,
): HistoricalObservationV2[] {
  return seed.historicalObservations.filter((row) => row.admissionOptionId === optionId);
}

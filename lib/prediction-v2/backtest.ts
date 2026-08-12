import type { Branch } from "@/lib/grade-scales";
import {
  calculatePredictionV2,
  evaluatePredictionV2Holdout,
  evaluatePredictionV2Stage1_2026,
  getPredictionV2Seed,
  type PredictionV2EvaluationRow,
} from "@/lib/prediction-v2/model";
import type { PredictionV2Seed } from "@/lib/prediction-v2/types";

function round(value: number, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values: number[], probability: number) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

export function predictionV2Metrics(rows: PredictionV2EvaluationRow[]) {
  const absoluteErrors = rows.map((row) => Math.abs(row.actual - row.predicted));
  const intervalHits = rows.filter((row) => Math.abs(row.actual - row.predicted) <= row.intervalHalfWidth).length;
  const branchMetrics = Object.fromEntries(
    (["science", "mathematics", "literary"] as const).map((branch) => {
      const branchRows = rows.filter((row) => row.branch === branch);
      const errors = branchRows.map((row) => Math.abs(row.actual - row.predicted));
      return [branch, {
        sampleSize: errors.length,
        mae: errors.length ? round(errors.reduce((sum, value) => sum + value, 0) / errors.length) : null,
        medianAe: errors.length ? round(median(errors)) : null,
        p80: errors.length ? round(quantile(errors, 0.8)) : null,
        p90: errors.length ? round(quantile(errors, 0.9)) : null,
        intervalCoverage: branchRows.length
          ? round(branchRows.filter((row) => Math.abs(row.actual - row.predicted) <= row.intervalHalfWidth).length / branchRows.length)
          : null,
      }];
    }),
  );
  return {
    sampleSize: rows.length,
    mae: absoluteErrors.length ? round(absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length) : null,
    medianAe: absoluteErrors.length ? round(median(absoluteErrors)) : null,
    p80: absoluteErrors.length ? round(quantile(absoluteErrors, 0.8)) : null,
    p90: absoluteErrors.length ? round(quantile(absoluteErrors, 0.9)) : null,
    intervalCoverage: rows.length ? round(intervalHits / rows.length) : null,
    byBranch: branchMetrics,
  };
}

export function predictionV2ScoreBandMetrics(seed: PredictionV2Seed) {
  const bands = [50, 55, 60, 65, 67.5, 69.84375, 70, 72.5, 75, 77.5, 80, 82.5, 85, 87.5, 90, 92.5, 95];
  const rows: Array<{
    branch: Branch;
    percentage: number;
    eligible: boolean;
    candidateVacancies: number;
    modeledCandidates: number;
    green: number;
    yellow: number;
    orange: number;
    red: number;
    realisticOptions: number;
    coverageWarning: boolean;
    top5Usefulness: number;
    top10Usefulness: number;
  }> = [];
  for (const branch of ["science", "mathematics", "literary"] as const) {
    for (const percentage of bands) {
      const score = (percentage / 100) * 320;
      const report = calculatePredictionV2({
        score,
        maxScore: 320,
        percentage,
        educationSystem: "new",
        branch,
        governorate: "الإسكندرية",
        aptitudeTestPassed: false,
        seed,
      });
      const ordered = [
        ...report.groups.closest.items,
        ...report.groups.ambitious.items,
        ...report.groups.higherThanScore.items,
      ];
      const useful = (limit: number) => {
        const candidates = ordered.slice(0, limit);
        if (!candidates.length) return 0;
        return round(candidates.filter((row) => row.fit !== "red").length / candidates.length);
      };
      rows.push({
        branch,
        percentage,
        eligible: report.eligibility.eligible,
        candidateVacancies: report.diagnostics.candidateVacancies,
        modeledCandidates: report.diagnostics.modeledCandidates,
        ...report.diagnostics.fitCounts,
        realisticOptions: report.diagnostics.realisticOptions,
        coverageWarning: report.coverageWarning.active,
        top5Usefulness: useful(5),
        top10Usefulness: useful(10),
      });
    }
  }
  const eligibleRows = rows.filter((row) => row.eligible && row.modeledCandidates > 0);
  return {
    rows,
    eligibleReportCount: eligibleRows.length,
    allRedReportRate: eligibleRows.length
      ? round(eligibleRows.filter((row) => row.red === row.modeledCandidates).length / eligibleRows.length)
      : null,
    zeroRealisticOptionRate: eligibleRows.length
      ? round(eligibleRows.filter((row) => row.realisticOptions === 0).length / eligibleRows.length)
      : null,
    meanTop5Usefulness: eligibleRows.length
      ? round(eligibleRows.reduce((sum, row) => sum + row.top5Usefulness, 0) / eligibleRows.length)
      : null,
    meanTop10Usefulness: eligibleRows.length
      ? round(eligibleRows.reduce((sum, row) => sum + row.top10Usefulness, 0) / eligibleRows.length)
      : null,
  };
}

export function runPredictionV2Backtests(seed = getPredictionV2Seed()) {
  const holdout2024 = predictionV2Metrics(evaluatePredictionV2Holdout(2024, seed));
  const holdout2025 = predictionV2Metrics(evaluatePredictionV2Holdout(2025, seed));
  const validation2026 = predictionV2Metrics(evaluatePredictionV2Stage1_2026(seed));
  const scoreBands = predictionV2ScoreBandMetrics(seed);
  const dataQualityReady = seed.diagnostics.activationBlockers.length === 0;
  const modelQualityReady =
    holdout2024.sampleSize >= 100 &&
    holdout2025.sampleSize >= 100 &&
    validation2026.sampleSize >= 20 &&
    (holdout2024.mae ?? Number.POSITIVE_INFINITY) <= 4 &&
    (holdout2025.mae ?? Number.POSITIVE_INFINITY) <= 3.5 &&
    (validation2026.mae ?? Number.POSITIVE_INFINITY) <= 3 &&
    (holdout2025.p90 ?? Number.POSITIVE_INFINITY) <= 7 &&
    (validation2026.p90 ?? Number.POSITIVE_INFINITY) <= 5 &&
    (holdout2024.intervalCoverage ?? 0) >= 0.65 &&
    (holdout2024.intervalCoverage ?? 1) <= 0.97 &&
    (holdout2025.intervalCoverage ?? 0) >= 0.7 &&
    (holdout2025.intervalCoverage ?? 1) <= 0.97 &&
    (validation2026.intervalCoverage ?? 0) >= 0.75 &&
    (validation2026.intervalCoverage ?? 1) <= 0.97;
  const productQualityReady =
    (scoreBands.allRedReportRate ?? 1) <= 0.2 &&
    (scoreBands.zeroRealisticOptionRate ?? 1) <= 0.35 &&
    (scoreBands.meanTop5Usefulness ?? 0) >= 0.6;
  const blockers = [
    ...seed.diagnostics.activationBlockers,
    ...(!modelQualityReady ? ["MODEL_QUALITY_GATE_FAILED"] : []),
    ...(!productQualityReady ? ["PRODUCT_USEFULNESS_GATE_FAILED"] : []),
  ];
  return {
    modelVersion: seed.model.version,
    dataHash: seed.dataHash,
    evaluatedAt: seed.generatedAt,
    holdout2024,
    holdout2025,
    validation2026,
    scoreBands,
    gates: {
      dataQualityReady,
      modelQualityReady,
      productQualityReady,
      activationReady: dataQualityReady && modelQualityReady && productQualityReady,
      blockers,
    },
  };
}

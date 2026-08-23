import { describe, expect, it } from "vitest";
import stage3Json from "@/lib/coordination-data/stage3-2026.json";
import { calculateStage3Prediction, toFreeStage3Report } from "@/lib/prediction-stage3/model";
import type { Stage3Seed } from "@/lib/prediction-stage3/types";

const seed = stage3Json as unknown as Stage3Seed;
const input = {
  score: 230,
  maxScore: 320,
  percentage: 71.88,
  educationSystem: "new" as const,
  branch: "science" as const,
  governorate: "القاهرة",
};

describe("stage3-2026-v1", () => {
  it("locks the reconciled official public vacancy universe", () => {
    expect(seed.diagnostics.resolvedOptionsByBranch).toEqual({ science: 323, mathematics: 313, literary: 135 });
    expect(seed.diagnostics.unresolvedPublicRows).toBe(0);
    expect(seed.diagnostics.ambiguousPublicRows).toBe(0);
  });

  it("recommends only officially listed Stage-3 options and separates fit", () => {
    const report = calculateStage3Prediction(input);
    const official = new Set(seed.stage3Vacancies.filter((row) => row.branch === input.branch).map((row) => row.admissionOptionId));
    const shown = [...report.recommendations, ...report.conditionalRecommendations];
    expect(report.availabilityStatus).toBe("official");
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((row) => official.has(row.admissionOptionId))).toBe(true);
    expect(shown.every((row) => row.availability === "listed_stage_3")).toBe(true);
    expect(JSON.stringify(report)).not.toContain("متوقع يظهر في المرحلة الثالثة");
  });

  it("keeps aptitude and gender constrained options outside normal recommendations", () => {
    const report = calculateStage3Prediction(input);
    expect(report.recommendations.every((row) => row.eligibilityCondition === null)).toBe(true);
    expect(report.conditionalRecommendations.every((row) => row.eligibilityCondition !== null)).toBe(true);
  });

  it("fails closed for the old system because no official vacancy artifact was found", () => {
    const report = calculateStage3Prediction({ ...input, educationSystem: "old", score: 250, maxScore: 410, percentage: 60.98 });
    expect(report.availabilityStatus).toBe("official_list_unavailable_for_old_system");
    expect(report.recommendations).toHaveLength(0);
    expect(report.diagnostics.officialVacancies).toBe(0);
  });

  it("does not recommend options below the official registration floor", () => {
    const report = calculateStage3Prediction({ ...input, score: 159, percentage: 49.69 });
    expect(report.registration.eligible).toBe(false);
    expect(report.recommendations).toHaveLength(0);
    expect(report.conditionalRecommendations).toHaveLength(0);
  });

  it("creates a locked free projection without changing the full report", () => {
    const full = calculateStage3Prediction(input);
    const free = toFreeStage3Report(full, 1);
    expect(full.premium).toBe(true);
    expect(free.premium).toBe(false);
    expect(free.recommendations.length + free.conditionalRecommendations.length).toBe(1);
    expect(free.lockedRecommendationCount).toBe(full.totalRecommendationCount - 1);
  });

  it("records the empirical same-year calibration improvement", () => {
    const baseline = seed.evaluation.baseline as { mae: number };
    const calibrated = seed.evaluation.calibratedLeaveOneOut as { mae: number };
    expect(seed.evaluation.sampleSize).toBeGreaterThan(400);
    expect(calibrated.mae).toBeLessThan(baseline.mae);
  });
});

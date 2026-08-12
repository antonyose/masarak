import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculatePredictionV2, getPredictionV2Seed } from "@/lib/prediction-v2/model";

const seed = getPredictionV2Seed();
const regressionInput = {
  score: 223.5,
  maxScore: 320,
  percentage: 69.84375,
  educationSystem: "new" as const,
  branch: "science" as const,
  governorate: "الإسكندرية",
  aptitudeTestPassed: false,
};

describe("Prediction V2 eligibility, model, ranking, and report composition", () => {
  it("fixes the reported 223.5/320 all-red regression", () => {
    const report = calculatePredictionV2(regressionInput);
    expect(report.modelVersion).toBe("stage2-2026-v2-shadow");
    expect(report.eligibility).toMatchObject({ eligible: true, minimumScore: 220 });
    expect(report.diagnostics.candidateVacancies).toBeGreaterThan(450);
    expect(report.diagnostics.realisticOptions).toBeGreaterThan(20);
    expect(report.groups.closest.items.length).toBeGreaterThan(0);
    expect(report.groups.closest.items.every((row) => row.fit === "green" || row.fit === "yellow")).toBe(true);
    expect(report.groups.closest.items[0].fit).not.toBe("red");
  });

  it("ranks score relevance before geography inside realistic options", () => {
    const report = calculatePredictionV2(regressionInput);
    const closest = report.groups.closest.items;
    for (let index = 1; index < closest.length; index += 1) {
      const previousBucket = Math.floor(Math.abs(closest[index - 1].difference) / seed.model.relevanceBucketWidth);
      const currentBucket = Math.floor(Math.abs(closest[index].difference) / seed.model.relevanceBucketWidth);
      expect(currentBucket).toBeGreaterThanOrEqual(previousBucket);
    }
    const farRealistic = closest.find((row) => row.proximityTier === "other");
    const nearbyImpossible = report.groups.higherThanScore.items.find((row) => row.proximityTier !== "other");
    expect(farRealistic).toBeDefined();
    expect(nearbyImpossible).toBeDefined();
  });

  it("caps and collapses red recommendations", () => {
    const report = calculatePredictionV2(regressionInput);
    expect(report.groups.higherThanScore.items).toHaveLength(seed.model.redDisplayCap);
    expect(report.groups.higherThanScore.hiddenCount).toBeGreaterThan(0);
    expect(report.groups.higherThanScore.collapsed).toBe(true);
    expect(report.recommendations.filter((row) => row.fit === "red")).toHaveLength(seed.model.redDisplayCap);
  });

  it("applies aptitude eligibility before prediction", () => {
    const blocked = calculatePredictionV2({ ...regressionInput, branch: "mathematics", percentage: 75, score: 240, aptitudeTestPassed: false });
    const passed = calculatePredictionV2({ ...regressionInput, branch: "mathematics", percentage: 75, score: 240, aptitudeTestPassed: true });
    expect(blocked.recommendations.every((row) => !row.requiresAptitudeTest)).toBe(true);
    expect(passed.diagnostics.modeledCandidates).toBeGreaterThan(blocked.diagnostics.modeledCandidates);
  });

  it("keeps Stage-1 closed facts outside normal recommendations", () => {
    const report = calculatePredictionV2({ ...regressionInput, percentage: 93.75, score: 300 });
    const closed = report.officialClosedFacts.find((row) => row.officialNameArabic === "طب القاهرة");
    expect(closed).toBeDefined();
    expect(report.recommendations.some((row) => row.officialNameArabic === "طب القاهرة")).toBe(false);
  });

  it("keeps pre-publication Stage-3 forecasts separate and never labels them official", () => {
    const report = calculatePredictionV2({ ...regressionInput, percentage: 60, score: 192 });
    expect(report.eligibility.status).toBe("below_stage_2_floor");
    expect(report.recommendations).toEqual([]);
    expect(report.groups.stage3Forecast.items.length).toBeGreaterThan(0);
    expect(report.groups.stage3Forecast.items.every((row) =>
      row.availability === "forecast_stage_3" && row.availabilityLabel === "متوقع يظهر في المرحلة الثالثة",
    )).toBe(true);
    expect(JSON.stringify(report.groups.stage3Forecast)).not.toContain("متاح رسميًا");
  });

  it.each([
    ["science", 50], ["science", 70], ["science", 90],
    ["mathematics", 50], ["mathematics", 70], ["mathematics", 90],
    ["literary", 50], ["literary", 70], ["literary", 90],
  ] as const)("handles %s at %s%% without crossing branch or stage rules", (branch, percentage) => {
    const report = calculatePredictionV2({
      score: (percentage / 100) * 320,
      maxScore: 320,
      percentage,
      educationSystem: "new",
      branch,
      governorate: "القاهرة",
      aptitudeTestPassed: false,
    });
    expect(report.branch).toBe(branch);
    expect(report.recommendations.every((row) => row.branch === branch && row.availability === "listed_stage_2")).toBe(true);
    expect(report.groups.higherThanScore.items.length).toBeLessThanOrEqual(seed.model.redDisplayCap);
  });

  it("produces deterministic versioned snapshots", () => {
    const first = calculatePredictionV2(regressionInput);
    const second = calculatePredictionV2(regressionInput);
    const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    expect(hash(first)).toBe(hash(second));
    expect(first).toMatchObject({
      schemaVersion: "prediction-v2-report@1",
      modelVersion: "stage2-2026-v2-shadow",
      shadow: true,
      modelMode: "normalized_percentage",
    });
  });

  it("never recommends a private/high institute or mixes the separate institute layer", () => {
    const report = calculatePredictionV2(regressionInput);
    expect(report.recommendations.every((row) =>
      row.institutionClass === "public_university" || row.institutionClass === "public_technological_university",
    )).toBe(true);
    expect(report.recommendations.some((row) => /معهد|العالي|العالى/u.test(row.officialNameArabic))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { runPredictionV2Backtests } from "@/lib/prediction-v2/backtest";

const result = runPredictionV2Backtests();

describe("Prediction V2 rolling backtests and activation gates", () => {
  it("tracks the complete requested error and interval metrics", () => {
    for (const metrics of [result.holdout2024, result.holdout2025, result.validation2026]) {
      expect(metrics.sampleSize).toBeGreaterThan(20);
      expect(metrics.mae).toBeTypeOf("number");
      expect(metrics.medianAe).toBeTypeOf("number");
      expect(metrics.p80).toBeTypeOf("number");
      expect(metrics.p90).toBeTypeOf("number");
      expect(metrics.intervalCoverage).toBeTypeOf("number");
    }
  });

  it("tracks all-red, zero-realistic, and top-5/top-10 usefulness across score bands", () => {
    expect(result.scoreBands.rows.some((row) => row.percentage === 50)).toBe(true);
    expect(result.scoreBands.rows.some((row) => row.percentage === 95)).toBe(true);
    expect(result.scoreBands.rows.some((row) => row.branch === "science")).toBe(true);
    expect(result.scoreBands.rows.some((row) => row.branch === "mathematics")).toBe(true);
    expect(result.scoreBands.rows.some((row) => row.branch === "literary")).toBe(true);
    expect(result.scoreBands.allRedReportRate).toBeTypeOf("number");
    expect(result.scoreBands.zeroRealisticOptionRate).toBeTypeOf("number");
    expect(result.scoreBands.meanTop5Usefulness).toBeTypeOf("number");
    expect(result.scoreBands.meanTop10Usefulness).toBeTypeOf("number");
  });

  it("keeps activation blocked when official data-quality gates are incomplete", () => {
    expect(result.gates.modelQualityReady).toBe(true);
    expect(result.gates.productQualityReady).toBe(true);
    expect(result.gates.dataQualityReady).toBe(false);
    expect(result.gates.activationReady).toBe(false);
    expect(result.gates.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining("STAGE2_OFFICIAL_ARTIFACT_REQUIRED"),
      expect.stringContaining("APTITUDE_2026_GUIDE_REQUIRED"),
    ]));
  });
});

import { describe, expect, it } from "vitest";
import { runPredictionV2Backtests } from "@/lib/prediction-v2/backtest";
import { getPredictionV2Seed } from "@/lib/prediction-v2/model";

const result = runPredictionV2Backtests();
const seed = getPredictionV2Seed();

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

  it("clears activation gates after official Stage-2 and aptitude reconciliation", () => {
    expect(result.gates.modelQualityReady).toBe(true);
    expect(result.gates.productQualityReady).toBe(true);
    expect(result.gates.dataQualityReady).toBe(true);
    expect(result.gates.activationReady).toBe(true);
    expect(result.gates.blockers).toEqual([]);
    const stage2Sources = seed.sources.filter((source) => source.key.startsWith("stage2-2026"));
    expect(stage2Sources).toHaveLength(2);
    expect(stage2Sources.every((source) => source.tier === "A" && source.officialArtifact)).toBe(true);
    expect(stage2Sources.map((source) => source.rowCount).sort((a, b) => a - b)).toEqual([434, 1029]);
    expect(seed.sources.find((source) => source.key === "aptitude-2026-official")).toMatchObject({
      tier: "A",
      officialArtifact: true,
      rowCount: 6,
    });
  });
});

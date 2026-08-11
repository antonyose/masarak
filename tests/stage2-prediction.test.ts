import { describe, expect, it } from "vitest";
import {
  calculateStage2Report,
  getOfficialStage1Fact,
  toFreeStage2Report,
} from "@/lib/stage2-prediction";

describe("2026 Stage-2 prediction engine", () => {
  it("blocks normal predictions below the new-system scientific minimum", () => {
    const report = calculateStage2Report({
      score: 219.5,
      maxScore: 320,
      percentage: (219.5 / 320) * 100,
      educationSystem: "new",
      branch: "science",
    });
    expect(report.eligibility.status).toBe("not_eligible_current_stage");
    expect(report.recommendations).toEqual([]);
  });

  it("preserves unusual official Stage-1 cutoff values", () => {
    expect(getOfficialStage1Fact("طب أسنان بني سويف", "science")?.score).toBe(
      298.7,
    );
    expect(getOfficialStage1Fact("هندسة السويس", "mathematics")?.score).toBe(
      282.2,
    );
  });

  it("treats closed Stage-1 faculties as facts, not weak predictions", () => {
    const report = calculateStage2Report({
      score: 300,
      maxScore: 320,
      percentage: 93.75,
      educationSystem: "new",
      branch: "science",
    });
    expect(
      report.officialClosedFacts.find(
        (item) => item.officialNameArabic === "طب القاهرة",
      ),
    ).toMatchObject({ status: "officially_closed_stage_1", score: 308 });
  });

  it("does not fabricate old-system predictions when facts are incomplete", () => {
    const report = calculateStage2Report({
      score: 300,
      maxScore: 410,
      percentage: (300 / 410) * 100,
      educationSystem: "old",
      branch: "science",
    });
    expect(report.eligibility.status).toBe("availability_unknown");
    expect(report.confidence).toBe("منخفضة");
    expect(report.recommendations).toEqual([]);
  });

  it("serializes only the configured free recommendation count", () => {
    const full = calculateStage2Report({
      score: 288,
      maxScore: 320,
      percentage: 90,
      educationSystem: "new",
      branch: "science",
    });
    const free = toFreeStage2Report(full, 1);
    expect(free.recommendations).toHaveLength(Math.min(1, full.recommendations.length));
    expect(free.lockedRecommendationCount).toBe(
      Math.max(0, full.recommendations.length - 1),
    );
    expect(JSON.stringify(free)).not.toContain(
      full.recommendations[1]?.officialNameArabic ?? "__no_second_item__",
    );
  });
});

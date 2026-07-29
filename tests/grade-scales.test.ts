import { describe, expect, it } from "vitest";
import {
  getMaxScore,
  percentageToScore,
  scoreToPercentage,
} from "@/lib/grade-scales";

describe("grade scales", () => {
  it("validates new-system 320 point years", () => {
    expect(getMaxScore(2026, "new")).toBe(320);
    expect(scoreToPercentage(288, 320)).toBe(90);
  });

  it("keeps old-system 410 point years separate", () => {
    expect(getMaxScore(2024, "old")).toBe(410);
    expect(getMaxScore(2024, "new")).toBeNull();
  });

  it("converts percentage back to the matching scale", () => {
    expect(percentageToScore(90, 320)).toBe(288);
    expect(percentageToScore(90, 410)).toBe(369);
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyPrediction,
  estimateRankPercentile,
  predictFaculties,
  selectRecommendedFaculties,
} from "@/lib/prediction";

describe("prediction engine", () => {
  it("gives stronger scores a better rank percentile", () => {
    expect(estimateRankPercentile(95)).toBeLessThan(
      estimateRankPercentile(85),
    );
  });

  it("classifies safe, target, reach and unlikely deterministically", () => {
    expect(classifyPrediction(0.02, 0.05, 0.01)).toBe("safe");
    expect(classifyPrediction(0.048, 0.05, 0.01)).toBe("target");
    expect(classifyPrediction(0.058, 0.05, 0.01)).toBe("reach");
    expect(classifyPrediction(0.08, 0.05, 0.01)).toBe("unlikely");
  });

  it("returns only faculties compatible with the selected branch", () => {
    const result = predictFaculties({ percentage: 91, branch: "mathematics" });
    expect(result.predictions.length).toBeGreaterThan(0);
    expect(
      result.predictions.every((faculty) => faculty.branch === "mathematics"),
    ).toBe(true);
  });

  it("puts the same governorate first within the same likelihood group", () => {
    const result = predictFaculties({
      percentage: 91,
      branch: "science",
      governorate: "الإسكندرية",
    });

    const safeOptions = result.predictions.filter(
      (faculty) => faculty.category === "safe",
    );
    expect(safeOptions[0].governorate).toBe("الإسكندرية");
    expect(safeOptions[0].proximityTier).toBe("same");
  });

  it("shows realistic nearby options for a 289 science student in Sohag", () => {
    const result = predictFaculties({
      percentage: (289 / 320) * 100,
      branch: "science",
      governorate: "سوهاج",
    });
    const nearbyViable = result.predictions.filter(
      (faculty) =>
        faculty.proximityTier !== "other" && faculty.category !== "unlikely",
    );

    expect(selectRecommendedFaculties(nearbyViable).map((faculty) => faculty.id)).toEqual(
      expect.arrayContaining([
        "veterinary_sohag",
        "nursing_sohag",
        "technical_health_sohag",
      ]),
    );
    expect(
      nearbyViable.slice(0, 6).some((faculty) => faculty.facultyName === "كلية الطب"),
    ).toBe(false);
  });

  it("does not lead with medicine for a 260 science student", () => {
    const result = predictFaculties({
      percentage: (260 / 320) * 100,
      branch: "science",
      governorate: "سوهاج",
    });
    const firstViable = result.predictions.find(
      (faculty) =>
        faculty.proximityTier !== "other" && faculty.category !== "unlikely",
    );

    expect(firstViable).toBeDefined();
    expect(firstViable?.facultyName).not.toBe("كلية الطب");
    expect(
      result.predictions.find((faculty) => faculty.id === "medicine_assiut")
        ?.category,
    ).toBe("unlikely");
  });
});

import { describe, expect, it } from "vitest";
import { generateSmartLockedTeasers } from "@/lib/smart-locked-teasers";

describe("generateSmartLockedTeasers", () => {
  it("generates tailored questions for high-scoring Scientific Science student", () => {
    const teasers = generateSmartLockedTeasers({
      branch: "science",
      score: 286,
      percentage: 89.38,
      governorate: "كفر الشيخ",
      isStage3: false,
    });

    expect(teasers).toHaveLength(3);
    // Question 1 should focus on top CS / AI faculties for this bracket
    expect(teasers[0].question).toContain("حاسبات ومعلومات");
    expect(teasers[0].question).toContain("286 درجة");
    expect(teasers[0].badgeText).toBe("متاح في التقرير 🔒");

    // Question 2 should address governorate and alienation reduction
    expect(teasers[1].question).toContain("كفر الشيخ");
    expect(teasers[1].question).toContain("تقليل الاغتراب");

    // Question 3 should address strategy and 75 choices
    expect(teasers[2].question).toContain("75 رغبة");
    expect(teasers[2].question).toContain("286 درجة");
  });

  it("generates tailored questions for Scientific Math student", () => {
    const teasers = generateSmartLockedTeasers({
      branch: "mathematics",
      score: 260,
      percentage: 81.25,
      governorate: "القاهرة",
      isStage3: false,
    });

    expect(teasers[0].question).toContain("الحاسبات");
    expect(teasers[1].question).toContain("القاهرة");
  });

  it("generates tailored questions for Literary student", () => {
    const teasers = generateSmartLockedTeasers({
      branch: "literary",
      score: 245,
      percentage: 76.5,
      governorate: "الإسكندرية",
      isStage3: false,
    });

    expect(teasers[0].question).toContain("الألسن");
    expect(teasers[1].question).toContain("الإسكندرية");
  });

  it("generates appropriate questions for Stage 3 forecast reports", () => {
    const teasers = generateSmartLockedTeasers({
      branch: "science",
      score: 205,
      percentage: 64.06,
      governorate: "المنيا",
      isStage3: true,
    });

    expect(teasers[0].question).toContain("المرحلة الثالثة");
    expect(teasers[1].question).toContain("المعاهد العليا المعتمدة");
  });
});

import { describe, expect, it } from "vitest";
import {
  DISCIPLINE_GROUPS,
  getDisciplineGroup,
  extractReportInsights,
  buildTansikBlueprint,
  type ReportItemSummary,
} from "@/lib/report-sectors";

describe("Report Sectors & Discipline Classification", () => {
  it("classifies nursing and health faculties into health sector", () => {
    expect(getDisciplineGroup("تمريض عين شمس").id).toBe("health");
    expect(getDisciplineGroup("فني صحي المنصورة").id).toBe("health");
    expect(getDisciplineGroup("صيدلة الزقازيق").id).toBe("health");
    expect(getDisciplineGroup("طب بيطري مطروح").id).toBe("health");
  });

  it("classifies computing & AI faculties into computing sector", () => {
    expect(getDisciplineGroup("حاسبات ومعلومات القاهرة").id).toBe("computing");
    expect(getDisciplineGroup("الذكاء الاصطناعي كفر الشيخ").id).toBe("computing");
  });

  it("classifies engineering and technology into engineering sector", () => {
    expect(getDisciplineGroup("هندسة عين شمس").id).toBe("engineering");
    expect(getDisciplineGroup("فنون تطبيقية حلوان").id).toBe("engineering");
    expect(getDisciplineGroup("الملاحة وتكنولوجيا الفضاء بني سويف").id).toBe("engineering");
  });

  it("classifies science and agriculture into science sector", () => {
    expect(getDisciplineGroup("علوم الزقازيق").id).toBe("science");
    expect(getDisciplineGroup("علوم كفر الشيخ").id).toBe("science");
    expect(getDisciplineGroup("زراعة الإسكندرية").id).toBe("science");
  });

  it("classifies languages, media & archaeology into languages sector", () => {
    expect(getDisciplineGroup("ألسن عين شمس").id).toBe("languages");
    expect(getDisciplineGroup("اعلام القاهرة").id).toBe("languages");
    expect(getDisciplineGroup("اثار القاهرة").id).toBe("languages");
  });

  it("classifies economics, politics & commerce into economics sector", () => {
    expect(getDisciplineGroup("اقتصاد و علوم سياسية القاهرة").id).toBe("economics");
    expect(getDisciplineGroup("الدراسات الاقتصادية و العلوم السياسة الإسكندرية").id).toBe("economics");
    expect(getDisciplineGroup("تجارة عين شمس").id).toBe("economics");
  });
});

describe("Report Insights & Blueprint Extraction", () => {
  const sampleItems: ReportItemSummary[] = [
    { id: "1", officialNameArabic: "علوم الزقازيق", fit: "green", proximityLabel: "قريبة منك" },
    { id: "2", officialNameArabic: "تمريض الإسكندرية", fit: "yellow", proximityLabel: "محافظة أخرى" },
    { id: "3", officialNameArabic: "تمريض عين شمس", fit: "yellow", proximityLabel: "محافظة أخرى" },
    { id: "4", officialNameArabic: "ألسن قناة السويس بالإسماعيلية", fit: "orange", proximityLabel: "قريبة منك" },
    { id: "5", officialNameArabic: "اقتصاد و علوم سياسية القاهرة", fit: "orange", proximityLabel: "محافظة أخرى" },
  ];

  it("extracts strategic insights correctly", () => {
    const insights = extractReportInsights({
      items: sampleItems,
      studentName: "يوسف محمد",
      score: 270.5,
      percentage: 84.53,
      governorate: "الشرقية",
    });

    expect(insights.topLocalOptions.length).toBeGreaterThan(0);
    expect(insights.topLocalOptions[0].officialNameArabic).toBe("علوم الزقازيق");
    expect(insights.topAmbitiousOptions.length).toBeGreaterThan(0);
    expect(insights.topAmbitiousOptions[0].officialNameArabic).toBe("ألسن قناة السويس بالإسماعيلية");
    expect(insights.hasNearbyGuaranteed).toBe(true);
    expect(insights.dominantSectors.length).toBeGreaterThan(0);
  });

  it("builds a 3-bracket Tansik blueprint", () => {
    const blueprint = buildTansikBlueprint(sampleItems);
    expect(blueprint).toHaveLength(3);
    expect(blueprint[0].rangeText).toBe("رغبات 1 – 15");
    expect(blueprint[1].rangeText).toBe("رغبات 16 – 50");
    expect(blueprint[2].rangeText).toBe("رغبات 51 – 75");
    expect(blueprint[0].sampleColleges).toContain("ألسن قناة السويس بالإسماعيلية");
    expect(blueprint[1].sampleColleges).toContain("علوم الزقازيق");
  });

  it("keeps Stage-3 insight copy explicitly predictive", () => {
    const insights = extractReportInsights({
      items: sampleItems,
      governorate: "الشرقية",
      isForecast: true,
    });

    expect(insights.strategicAdvice).toContain("توقعات");
    expect(insights.strategicAdvice).not.toContain("فرص قوية ومؤكدة");
  });

  it("does not label nationwide options as local when no local option exists", () => {
    const insights = extractReportInsights({
      items: sampleItems.map((item) => ({ ...item, proximityLabel: "محافظة أخرى" })),
      governorate: "الشرقية",
    });

    expect(insights.topLocalOptions).toHaveLength(0);
    expect(insights.hasNearbyGuaranteed).toBe(false);
  });
});

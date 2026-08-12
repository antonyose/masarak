import { describe, expect, it } from "vitest";
import predictionV2SeedJson from "@/lib/coordination-data/prediction-v2-2026.json";
import {
  classifyInstitution,
  findInstitution,
  normalizeOfficialLabel,
  optionIdentity,
} from "@/lib/prediction-v2/catalog";
import type { PredictionV2Seed } from "@/lib/prediction-v2/types";

const seed = predictionV2SeedJson as unknown as PredictionV2Seed;

describe("Prediction V2 canonical public catalog", () => {
  it("reconciles the complete frozen Stage-2 mirrors and keeps institutes separate", () => {
    expect(seed.diagnostics.rawStage2Rows).toEqual({ scientific: 1029, literary: 434 });
    expect(seed.diagnostics.publicSourceRows).toBeGreaterThanOrEqual(850);
    expect(seed.diagnostics.publicTechnologicalRows).toBeGreaterThanOrEqual(19);
    expect(seed.diagnostics.publicInstituteRows).toBeGreaterThanOrEqual(52);
    expect(
      seed.diagnostics.publicSourceRows +
      seed.diagnostics.publicInstituteRows +
      seed.diagnostics.privateOrHigherInstituteRows +
      seed.diagnostics.unknownRows,
    ).toBe(1029 + 434);
    expect(seed.stageVacancies.length).toBeGreaterThan(seed.diagnostics.publicSourceRows);
    expect(seed.stageVacancies.every((row) => row.resolutionStatus === "resolved")).toBe(true);
    expect(seed.separateInstitutes.length).toBeGreaterThan(0);
    expect(seed.admissionOptions.every((row) =>
      row.institutionClass === "public_university" || row.institutionClass === "public_technological_university",
    )).toBe(true);
  });

  it("never classifies private or higher institutes as government faculties", () => {
    expect(classifyInstitution("المعهد العالي للحاسبات بمدينة الشروق")).toBe("private_or_higher_institute");
    expect(classifyInstitution("معهد فني صحى اسوان")).toBe("public_institute");
    expect(classifyInstitution("حقوق الإسكندرية")).toBe("public_university");
    expect(classifyInstitution("كلية تكنولوجيا الصناعة والطاقة برج العرب التكنولوجية علوم")).toBe("public_technological_university");
  });

  it("resolves only explicit rename rules for العاصمة/حلوان and قنا/جنوب الوادي", () => {
    expect(optionIdentity("علوم حلوان", "science", "helwan").optionId).toBe(
      optionIdentity("علوم العاصمة", "science", "helwan").optionId,
    );
    expect(optionIdentity("علوم جنوب الوادي", "science", "south-valley").optionId).toBe(
      optionIdentity("علوم قنا", "science", "south-valley").optionId,
    );
  });

  it("fails closed when one label contains two unrelated institutions", () => {
    const label = "حقوق القاهرة الإسكندرية";
    expect(findInstitution(label, classifyInstitution(label))).toMatchObject({
      institution: null,
      status: "ambiguous",
    });
  });

  it("preserves branch and affiliation variants as distinct admission options", () => {
    const regular = optionIdentity("حقوق القاهرة", "literary", "cairo");
    const affiliation = optionIdentity("حقوق انتساب موجه القاهرة", "literary", "cairo");
    const science = optionIdentity("علوم القاهرة علوم", "science", "cairo");
    const mathematics = optionIdentity("علوم القاهرة رياضة", "mathematics", "cairo");
    expect(regular.optionId).not.toBe(affiliation.optionId);
    expect(science.optionId).not.toBe(mathematics.optionId);
  });

  it("preserves five years of raw values, scales, official labels, and source provenance", () => {
    expect(seed.diagnostics.historicalRawRows).toBe(8508);
    expect(new Set(seed.historicalObservations.map((row) => row.year))).toEqual(new Set([2021, 2022, 2023, 2024, 2025]));
    expect(seed.historicalObservations.filter((row) => row.year <= 2024).every((row) => row.maximumScore === 410)).toBe(true);
    expect(seed.historicalObservations.filter((row) => row.year === 2025).every((row) => row.maximumScore === 320)).toBe(true);
    const sourceKeys = new Set(seed.sources.map((source) => source.key));
    expect(seed.historicalObservations.every((row) => row.officialNameArabic && sourceKeys.has(row.sourceKey))).toBe(true);
    expect(seed.historicalObservations.every((row) =>
      row.minimumPercentage === Number(((row.minimumScore / row.maximumScore) * 100).toFixed(4)),
    )).toBe(true);
  });

  it("has no unresolved or ambiguous current public alias", () => {
    expect(seed.diagnostics.unresolvedPublicVacancies).toBe(0);
    expect(seed.diagnostics.ambiguousAliases).toBe(0);
    expect(seed.aliases.filter((row) => row.validFromYear === 2026).every((row) => row.status === "resolved")).toBe(true);
    expect(normalizeOfficialLabel("زراعة أسيوط/ رياضة")).toBe("زراعة اسيوط رياضة");
  });
});

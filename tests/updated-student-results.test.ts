import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn() }));

import { studentResultUpdateSchema } from "@/lib/schemas";
import { getMaxScore, percentageToScore, scoreToPercentage } from "@/lib/grade-scales";
import { enrichWithUpdatedResult } from "@/lib/results-repository";
import type { TursoStudentResult } from "@/lib/turso";
import type { updatedStudentResults } from "@/db/schema";


describe("Round 2 updated student results contract and helpers", () => {
  describe("studentResultUpdateSchema validation", () => {
    it("accepts valid score update payload for 2026", () => {
      const parsed = studentResultUpdateSchema.safeParse({
        year: 2026,
        seatNumber: "2001990",
        inputMethod: "score",
        score: 220.5,
        percentage: 68.91,
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts Arabic digits in seat number", () => {
      const parsed = studentResultUpdateSchema.safeParse({
        year: 2026,
        seatNumber: "٢٠٠١٩٩٠",
        inputMethod: "percentage",
        score: 200,
        percentage: 62.5,
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects negative score or percentage", () => {
      const parsedScore = studentResultUpdateSchema.safeParse({
        year: 2026,
        seatNumber: "2001990",
        inputMethod: "score",
        score: -5,
        percentage: 60,
      });
      expect(parsedScore.success).toBe(false);

      const parsedPct = studentResultUpdateSchema.safeParse({
        year: 2026,
        seatNumber: "2001990",
        inputMethod: "percentage",
        score: 200,
        percentage: -1,
      });
      expect(parsedPct.success).toBe(false);
    });

    it("rejects percentage above 100", () => {
      const parsed = studentResultUpdateSchema.safeParse({
        year: 2026,
        seatNumber: "2001990",
        inputMethod: "percentage",
        score: 350,
        percentage: 109.38,
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects non-2026 years", () => {
      const parsed = studentResultUpdateSchema.safeParse({
        year: 2025,
        seatNumber: "2001990",
        inputMethod: "score",
        score: 200,
        percentage: 62.5,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("Bidirectional conversion for 2026 (max 320)", () => {
    it("accurately converts score to percentage and back", () => {
      const maxScore = getMaxScore(2026, "new")!;
      expect(maxScore).toBe(320);

      const score = 224;
      const pct = scoreToPercentage(score, maxScore);
      expect(pct).toBe(70);

      const backToScore = percentageToScore(pct, maxScore);
      expect(backToScore).toBe(224);
    });

    it("handles fractional scores cleanly", () => {
      const maxScore = 320;
      const score = 217.5;
      const pct = Math.round((score / maxScore) * 10000) / 100;
      expect(pct).toBe(67.97);

      const computedScore = Math.round(((pct / 100) * maxScore) * 100) / 100;
      expect(Math.abs(computedScore - score)).toBeLessThan(0.1);
    });
  });

  describe("enrichWithUpdatedResult logic", () => {
    const baseStudent: TursoStudentResult = {
      year: 2026,
      seatNumber: "2001990",
      studentName: "طالب تجريبي",
      educationSystem: "new",
      branch: "science",
      branchLabel: "علمي علوم",
      totalScore: 180,
      maxScore: 320,
      percentage: 56.25,
      nationalRank: null,
      nationalTotalStudents: null,
      resultStatus: "دور ثان",
      schoolName: "مدرسة الاختبار",
      governorate: "القاهرة",
    };

    it("enriches student with updated score and marks as updated", () => {
      const mockOverride: typeof updatedStudentResults.$inferSelect = {
        id: "11111111-1111-1111-1111-111111111111",
        year: 2026,
        seatNumber: "2001990",
        updatedTotalScore: 210,
        updatedPercentage: 65.62,
        maxScore: 320,
        originalTotalScore: 180,
        originalPercentage: 56.25,
        inputMethod: "score",
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const enriched = enrichWithUpdatedResult(baseStudent, mockOverride);
      expect(enriched.isUpdatedResult).toBe(true);
      expect(enriched.totalScore).toBe(210);
      expect(enriched.percentage).toBe(65.62);
      expect(enriched.originalTotalScore).toBe(180);
      expect(enriched.originalPercentage).toBe(56.25);
      expect(enriched.canPromptRound2).toBe(false);
    });

    it("flags eligibility to prompt round 2 when percentage < 75 and no override exists", () => {
      const enriched = enrichWithUpdatedResult(baseStudent, null);
      expect(enriched.isUpdatedResult).toBe(false);
      expect(enriched.totalScore).toBe(180);
      expect(enriched.originalTotalScore).toBe(180);
      expect(enriched.canPromptRound2).toBe(true);
    });

    it("does not flag round 2 prompt if student score is >= 75%", () => {
      const highScoringStudent: TursoStudentResult = {
        ...baseStudent,
        totalScore: 280,
        percentage: 87.5,
      };

      const enriched = enrichWithUpdatedResult(highScoringStudent, null);
      expect(enriched.isUpdatedResult).toBe(false);
      expect(enriched.canPromptRound2).toBe(false);
    });
  });

  describe("publicPredictionCreateSchema with updated score", () => {
    it("accepts optional updatedScore and updatedPercentage", async () => {
      const { publicPredictionCreateSchema } = await import("@/lib/schemas");
      const parsed = publicPredictionCreateSchema.safeParse({
        year: 2026,
        seatNumber: "2261143",
        branch: "literary",
        updatedScore: 179.5,
        updatedPercentage: 56.09,
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("Stage 3 prediction eligibility with updated scores", () => {
    it("ensures updated score of 179.50 (56.09%) is eligible and never below 50% min cutoff", async () => {
      const { calculateStage3Prediction } = await import("@/lib/prediction-stage3/model");
      const report = calculateStage3Prediction({
        score: 179.5,
        maxScore: 320,
        percentage: 56.09,
        educationSystem: "new",
        branch: "literary",
      });

      expect(report.registration.eligible).toBe(true);
      expect(report.registration.minimumScore).toBe(160);
      expect(report.registration.minimumPercentage).toBe(50);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.groups.closest.items.length).toBeGreaterThan(0);
    });
  });
});

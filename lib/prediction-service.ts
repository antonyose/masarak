import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { coordinationCycles, modelVersions, predictionRuns, savedStudents } from "@/db/schema";
import type { Branch } from "@/lib/grade-scales";
import { getPaymentSettings } from "@/lib/settings";
import { calculateStage2Report, toFreeStage2Report } from "@/lib/stage2-prediction";
import { loadStage2CoordinationContext } from "@/lib/coordination-repository";
import { findTursoResultBySeat } from "@/lib/turso";
import { recordPredictionV2Shadow } from "@/lib/prediction-v2/shadow-service";
import {
  calculatePredictionV2,
  isPredictionV2Report,
  toFreePredictionV2Report,
} from "@/lib/prediction-v2/model";
import type { PredictionV2Report } from "@/lib/prediction-v2/types";
import { calculateStage3Prediction, isStage3Report, toFreeStage3Report } from "@/lib/prediction-stage3/model";
import type { Stage3Report } from "@/lib/prediction-stage3/types";

type Stage2Input = Parameters<typeof calculateStage2Report>[0];
type ActivePredictionReport = ReturnType<typeof calculateStage2Report> | PredictionV2Report | Stage3Report;

function usesPredictionV2(model: { version: string }) {
  return model.version === "stage2-2026-v2-shadow" || model.version.startsWith("stage2-2026-v2");
}

async function calculateReportForModel(
  model: Awaited<ReturnType<typeof getActivePredictionModel>>,
  input: Stage2Input,
): Promise<ActivePredictionReport> {
  if (model.stage === 3 || model.version.startsWith("stage3-2026")) {
    return calculateStage3Prediction({
      score: input.score,
      maxScore: input.maxScore,
      percentage: input.percentage,
      educationSystem: input.educationSystem,
      branch: input.branch,
      governorate: input.governorate,
    });
  }
  if (usesPredictionV2(model)) {
    return calculatePredictionV2({
      score: input.score,
      maxScore: input.maxScore,
      percentage: input.percentage,
      educationSystem: input.educationSystem,
      branch: input.branch,
      governorate: input.governorate,
    });
  }
  const context = await loadStage2CoordinationContext(model);
  return calculateStage2Report({ ...input, ...context });
}

async function safelyRecordV2Shadow(
  input: Parameters<typeof recordPredictionV2Shadow>[0],
) {
  try {
    await recordPredictionV2Shadow(input);
  } catch (error) {
    // Shadow instrumentation must never change or fail the V1 student flow.
    console.error("Prediction V2 shadow write failed:", error);
  }
}

export function deterministicInputHash(input: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(input, Object.keys(input).sort()))
    .digest("hex");
}

export async function getActiveStage2Model() {
  const [model] = await getDatabase()
    .select()
    .from(modelVersions)
    .innerJoin(
      coordinationCycles,
      eq(coordinationCycles.activeModelVersionId, modelVersions.id),
    )
    .where(
      and(
        eq(modelVersions.year, 2026),
        eq(modelVersions.stage, 2),
        eq(coordinationCycles.year, 2026),
      ),
    )
    .orderBy(desc(modelVersions.activatedAt))
    .limit(1);
  if (!model) throw new Error("NO_ACTIVE_STAGE2_MODEL");
  return model.model_versions;
}

export async function getActivePredictionModel() {
  const [model] = await getDatabase()
    .select()
    .from(modelVersions)
    .innerJoin(coordinationCycles, eq(coordinationCycles.activeModelVersionId, modelVersions.id))
    .where(and(eq(modelVersions.year, 2026), eq(coordinationCycles.year, 2026)))
    .orderBy(desc(modelVersions.activatedAt))
    .limit(1);
  if (!model) throw new Error("NO_ACTIVE_PREDICTION_MODEL");
  return model.model_versions;
}

export async function createImmutablePrediction({
  userId,
  student,
  governorate,
}: {
  userId: string;
  student: typeof savedStudents.$inferSelect;
  governorate?: string;
}) {
  const model = await getActivePredictionModel();
  const settings = await getPaymentSettings();
  if (
    (student.educationSystem !== "new" && student.educationSystem !== "old") ||
    (student.branch !== "science" && student.branch !== "mathematics" && student.branch !== "literary")
  ) {
    throw new Error("UNSUPPORTED_STUDENT_SNAPSHOT");
  }
  const report = await calculateReportForModel(model, {
    score: student.scoreSnapshot,
    maxScore: student.maxScoreSnapshot,
    percentage: student.percentageSnapshot,
    educationSystem: student.educationSystem,
    branch: student.branch,
    governorate,
    branchSource: student.branchSource,
  });
  const inputHash = deterministicInputHash({
    year: 2026,
    stage: model.stage,
    modelVersionId: model.id,
    studentSnapshot: student.resultSnapshotJson,
    branch: student.branch,
    governorate: governorate ?? null,
  });
  const [created] = await getDatabase()
    .insert(predictionRuns)
    .values({
      userId,
      savedStudentId: student.id,
      year: 2026,
      seatNumber: student.seatNumber,
      coordinationStage: model.stage,
      modelVersionId: model.id,
      modelMode: report.modelMode,
      score: report.score,
      percentage: report.percentage,
      branch: report.branch,
      governorate: governorate ?? null,
      inputHash,
      freeRecommendationCountSnapshot: settings.freeRecommendationCount,
      resultSnapshotJson: report,
    })
    .onConflictDoNothing()
    .returning();
  if (created && model.stage === 2 && !usesPredictionV2(model)) {
    await safelyRecordV2Shadow({
      productionPredictionRunId: created.id,
      score: report.score,
      maxScore: report.maxScore,
      percentage: report.percentage,
      educationSystem: report.educationSystem,
      branch: report.branch,
      governorate,
    });
  }
  if (created) return { run: created, report };
  const [existing] = await getDatabase()
    .select()
    .from(predictionRuns)
    .where(
      and(
        eq(predictionRuns.userId, userId),
        eq(predictionRuns.savedStudentId, student.id),
        eq(predictionRuns.modelVersionId, model.id),
        eq(predictionRuns.inputHash, inputHash),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("PREDICTION_CREATE_FAILED");
  if (model.stage === 2 && !usesPredictionV2(model)) {
    await safelyRecordV2Shadow({
      productionPredictionRunId: existing.id,
      score: existing.score,
      maxScore: report.maxScore,
      percentage: existing.percentage,
      educationSystem: report.educationSystem,
      branch: report.branch,
      governorate,
    });
  }
  return { run: existing, report: existing.resultSnapshotJson as unknown as typeof report };
}

export async function createPublicImmutablePrediction({
  seatNumber,
  branch,
  governorate,
}: {
  seatNumber: string;
  branch: Branch;
  governorate?: string;
}) {
  const result = await findTursoResultBySeat(2026, seatNumber);
  if (!result || result.totalScore == null || result.maxScore == null || result.percentage == null) {
    throw new Error("RESULT_NOT_FOUND");
  }
  if (result.educationSystem !== "new" && result.educationSystem !== "old") {
    throw new Error("UNSUPPORTED_RESULT_SYSTEM");
  }

  const model = await getActivePredictionModel();
  const settings = await getPaymentSettings();
  const report = await calculateReportForModel(model, {
    score: result.totalScore,
    maxScore: result.maxScore,
    percentage: result.percentage,
    educationSystem: result.educationSystem,
    branch,
    governorate,
    branchSource: "user_provided",
  });
  const inputHash = deterministicInputHash({
    year: 2026,
    stage: model.stage,
    modelVersionId: model.id,
    seatNumber: result.seatNumber,
    resultSnapshot: result,
    branch,
    governorate: governorate ?? null,
  });
  const [created] = await getDatabase()
    .insert(predictionRuns)
    .values({
      userId: null,
      savedStudentId: null,
      year: 2026,
      seatNumber: result.seatNumber,
      coordinationStage: model.stage,
      modelVersionId: model.id,
      modelMode: report.modelMode,
      score: report.score,
      percentage: report.percentage,
      branch: report.branch,
      governorate: governorate ?? null,
      inputHash,
      freeRecommendationCountSnapshot: settings.freeRecommendationCount,
      resultSnapshotJson: report,
    })
    .onConflictDoNothing()
    .returning();
  if (created && model.stage === 2 && !usesPredictionV2(model)) {
    await safelyRecordV2Shadow({
      productionPredictionRunId: created.id,
      score: report.score,
      maxScore: report.maxScore,
      percentage: report.percentage,
      educationSystem: report.educationSystem,
      branch: report.branch,
      governorate,
    });
  }
  if (created) return { run: created, report, result };

  const [existing] = await getDatabase()
    .select()
    .from(predictionRuns)
    .where(
      and(
        eq(predictionRuns.year, 2026),
        eq(predictionRuns.seatNumber, result.seatNumber),
        eq(predictionRuns.modelVersionId, model.id),
        eq(predictionRuns.inputHash, inputHash),
        isNull(predictionRuns.userId),
        isNull(predictionRuns.savedStudentId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("PREDICTION_CREATE_FAILED");
  if (model.stage === 2 && !usesPredictionV2(model)) {
    await safelyRecordV2Shadow({
      productionPredictionRunId: existing.id,
      score: existing.score,
      maxScore: report.maxScore,
      percentage: existing.percentage,
      educationSystem: report.educationSystem,
      branch: report.branch,
      governorate,
    });
  }
  return {
    run: existing,
    report: existing.resultSnapshotJson as unknown as typeof report,
    result,
  };
}

export async function calculateActivePredictionReport(input: Stage2Input) {
  const model = await getActivePredictionModel();
  return calculateReportForModel(model, input);
}

/** @deprecated Kept for server-call compatibility; the active cycle now selects the stage. */
export const calculateActiveStage2Report = calculateActivePredictionReport;

export function publicPredictionPayload(
  report: ActivePredictionReport,
  freeRecommendationCount: number,
) {
  if (isStage3Report(report)) {
    return toFreeStage3Report(report, freeRecommendationCount);
  }
  if (isPredictionV2Report(report)) {
    return toFreePredictionV2Report(report, freeRecommendationCount);
  }
  return toFreeStage2Report(report, freeRecommendationCount);
}

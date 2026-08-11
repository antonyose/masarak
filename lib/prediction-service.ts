import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { coordinationCycles, modelVersions, predictionRuns, savedStudents } from "@/db/schema";
import { getPaymentSettings } from "@/lib/settings";
import { calculateStage2Report, toFreeStage2Report } from "@/lib/stage2-prediction";
import { loadStage2CoordinationContext } from "@/lib/coordination-repository";

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

export async function createImmutablePrediction({
  userId,
  student,
  governorate,
}: {
  userId: string;
  student: typeof savedStudents.$inferSelect;
  governorate?: string;
}) {
  const model = await getActiveStage2Model();
  const context = await loadStage2CoordinationContext(model);
  const settings = await getPaymentSettings();
  if (
    (student.educationSystem !== "new" && student.educationSystem !== "old") ||
    (student.branch !== "science" && student.branch !== "mathematics" && student.branch !== "literary")
  ) {
    throw new Error("UNSUPPORTED_STUDENT_SNAPSHOT");
  }
  const report = calculateStage2Report({
    score: student.scoreSnapshot,
    maxScore: student.maxScoreSnapshot,
    percentage: student.percentageSnapshot,
    educationSystem: student.educationSystem,
    branch: student.branch,
    governorate,
    branchSource: student.branchSource,
    ...context,
  });
  const inputHash = deterministicInputHash({
    year: 2026,
    stage: 2,
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
      coordinationStage: 2,
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
  return { run: existing, report: existing.resultSnapshotJson as unknown as typeof report };
}

export async function calculateActiveStage2Report(input: Parameters<typeof calculateStage2Report>[0]) {
  const model = await getActiveStage2Model();
  const context = await loadStage2CoordinationContext(model);
  return calculateStage2Report({ ...input, ...context });
}

export function publicPredictionPayload(
  report: ReturnType<typeof calculateStage2Report>,
  freeRecommendationCount: number,
) {
  return toFreeStage2Report(report, freeRecommendationCount);
}

import "server-only";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { modelVersions, predictionShadowRuns } from "@/db/schema";
import type { Branch, EducationSystem } from "@/lib/grade-scales";
import { runPredictionV2Backtests } from "@/lib/prediction-v2/backtest";
import { calculatePredictionV2, getPredictionV2Seed } from "@/lib/prediction-v2/model";

export const PREDICTION_V2_SHADOW_VERSION = "stage2-2026-v2-shadow" as const;
let diagnosticsCache: ReturnType<typeof buildPredictionV2ShadowDiagnostics> | null = null;

function shadowInputHash(input: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(input, Object.keys(input).sort()))
    .digest("hex");
}

function buildPredictionV2ShadowDiagnostics() {
  const seed = getPredictionV2Seed();
  const evaluation = runPredictionV2Backtests(seed);
  const regressionCase = calculatePredictionV2({
    score: 223.5,
    maxScore: 320,
    percentage: 69.84375,
    educationSystem: "new",
    branch: "science",
    governorate: "الإسكندرية",
    aptitudeTestPassed: false,
    seed,
  });
  return {
    modelVersion: seed.model.version,
    shadow: true,
    activated: false,
    dataHash: seed.dataHash,
    data: seed.diagnostics,
    evaluation,
    regressionCase,
  };
}

export function predictionV2ShadowDiagnostics() {
  diagnosticsCache ??= buildPredictionV2ShadowDiagnostics();
  return diagnosticsCache;
}

export async function recordPredictionV2Shadow({
  productionPredictionRunId,
  score,
  maxScore,
  percentage,
  educationSystem,
  branch,
  governorate,
}: {
  productionPredictionRunId: string;
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  governorate?: string;
}) {
  if (process.env.PREDICTION_V2_SHADOW_WRITE_ENABLED !== "true") {
    return { recorded: false, reason: "shadow_write_disabled" as const };
  }
  const seed = getPredictionV2Seed();
  const report = calculatePredictionV2({
    score,
    maxScore,
    percentage,
    educationSystem,
    branch,
    governorate,
    // The product does not collect this answer yet. Aptitude-gated options
    // therefore fail closed and are not silently treated as eligible.
    aptitudeTestPassed: false,
    seed,
  });
  const [model] = await getDatabase()
    .select({ id: modelVersions.id, activatedAt: modelVersions.activatedAt })
    .from(modelVersions)
    .where(eq(modelVersions.version, PREDICTION_V2_SHADOW_VERSION))
    .limit(1);
  if (!model) return { recorded: false, reason: "shadow_model_not_seeded" as const };
  if (model.activatedAt) throw new Error("V2 shadow model must not be activated by the shadow writer.");
  const inputHash = shadowInputHash({
    productionPredictionRunId,
    modelVersion: seed.model.version,
    dataHash: seed.dataHash,
    score,
    maxScore,
    percentage,
    educationSystem,
    branch,
    governorate: governorate ?? null,
  });
  await getDatabase()
    .insert(predictionShadowRuns)
    .values({
      productionPredictionRunId,
      modelVersionId: model.id,
      modelVersion: seed.model.version,
      inputHash,
      resultSnapshotJson: report,
      diagnosticsJson: {
        coverageWarning: report.coverageWarning,
        diagnostics: report.diagnostics,
        dataHash: seed.dataHash,
      },
    })
    .onConflictDoNothing();
  return { recorded: true, report };
}

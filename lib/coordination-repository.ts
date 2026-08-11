import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { coordinationStageRules, faculties, historicalCutoffs, modelVersions, officialCutoffs, stageVacancies } from "@/db/schema";
import type { Branch, EducationSystem } from "@/lib/grade-scales";
import type { Stage2HistoricalRow, Stage2ModelData } from "@/lib/stage2-prediction";

function supportedSystem(value: string): value is EducationSystem { return value === "new" || value === "old"; }
function supportedBranch(value: string): value is Branch { return value === "science" || value === "mathematics" || value === "literary"; }

export async function loadStage2CoordinationContext(model: typeof modelVersions.$inferSelect) {
  const db = getDatabase();
  const [rules, cutoffs, vacancies, history] = await Promise.all([
    db.select().from(coordinationStageRules).where(and(eq(coordinationStageRules.year, model.year), eq(coordinationStageRules.stage, model.stage))),
    db.select().from(officialCutoffs).where(and(eq(officialCutoffs.year, model.year), eq(officialCutoffs.stage, 1))),
    db.select().from(stageVacancies).where(and(eq(stageVacancies.year, model.year), eq(stageVacancies.stage, model.stage), eq(stageVacancies.isAvailable, true))),
    db.select({ year: historicalCutoffs.year, educationSystem: historicalCutoffs.educationSystem, branch: historicalCutoffs.branch, facultyId: historicalCutoffs.facultyId, officialNameArabic: faculties.nameArabic, minimumScore: historicalCutoffs.minimumScore, maximumScore: historicalCutoffs.maximumScore, minimumPercentage: historicalCutoffs.minimumPercentage, sourceUrl: historicalCutoffs.sourceUrl }).from(historicalCutoffs).innerJoin(faculties, eq(faculties.id, historicalCutoffs.facultyId)).where(and(gte(historicalCutoffs.year, 2023), lte(historicalCutoffs.year, 2025))),
  ]);
  const modelData: Stage2ModelData = {
    model: { ...(model.configurationJson as Record<string, unknown>), version: model.version, mode: model.mode },
    stageRules: rules.filter((row) => supportedSystem(row.educationSystem) && supportedBranch(row.branch)).map((row) => ({ stage: row.stage, educationSystem: row.educationSystem as EducationSystem, branch: row.branch as Branch, minimumScore: row.minimumScore, maximumScore: row.maximumScore, minimumPercentage: row.minimumPercentage, studentCount: row.studentCount })),
    officialCutoffs: cutoffs.filter((row) => supportedSystem(row.educationSystem) && supportedBranch(row.branch)).map((row) => ({ facultyKey: String(row.facultyId), officialNameArabic: row.officialNameArabic, score: row.minimumScore, maximumScore: row.maximumScore, percentage: row.minimumPercentage, educationSystem: row.educationSystem as EducationSystem, branch: row.branch as Branch, stage: row.stage })),
    stageVacancies: vacancies.filter((row) => supportedSystem(row.educationSystem) && supportedBranch(row.branch)).map((row) => ({ facultyKey: String(row.facultyId), officialNameArabic: row.officialNameArabic, educationSystem: row.educationSystem as EducationSystem, branch: row.branch as Branch, stage: row.stage, requiresAptitudeTest: row.requiresAptitudeTest })),
  };
  const historyRows: Stage2HistoricalRow[] = history.filter((row) => supportedSystem(row.educationSystem) && supportedBranch(row.branch)).map((row) => ({ year: row.year, educationSystem: row.educationSystem as EducationSystem, branch: row.branch as Branch, facultyKey: String(row.facultyId), officialNameArabic: row.officialNameArabic, minimumScore: row.minimumScore, maximumScore: row.maximumScore, minimumPercentage: row.minimumPercentage, sourceUrl: row.sourceUrl }));
  if (!modelData.stageRules.length || !modelData.stageVacancies.length || !historyRows.length) throw new Error("INCOMPLETE_ACTIVE_COORDINATION_DATA");
  return { modelData, historyRows };
}

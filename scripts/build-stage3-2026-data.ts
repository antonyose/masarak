import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import predictionV2Json from "../lib/coordination-data/prediction-v2-2026.json";
import stage3RawJson from "../lib/coordination-data/stage3-2026-raw.json";
import type { Branch, EducationSystem } from "../lib/grade-scales";
import {
  classifyInstitution,
  isPublicCoreClass,
  normalizeOfficialLabel,
  scientificBranchesForLabel,
  stableId,
} from "../lib/prediction-v2/catalog";
import { getPredictionV2RuntimeContextForTests, robustRecentLevel } from "../lib/prediction-v2/model";
import type { AliasRecordV2, PredictionV2Seed } from "../lib/prediction-v2/types";
import type {
  Stage2ActualCutoff,
  Stage3OfficialVacancy,
  Stage3Seed,
  Stage3Source,
} from "../lib/prediction-stage3/types";

const predictionV2 = predictionV2Json as unknown as PredictionV2Seed;
const stage3Raw = stage3RawJson as {
  retrievedAt: string;
  publisher: string;
  sources: Record<"scientific" | "literary", { url: string; sha256: string; rowCount: number }>;
  rows: Record<"scientific" | "literary", string[]>;
};
const outputPath = path.resolve("lib/coordination-data/stage3-2026.json");
const generatedAt = "2026-08-23T22:00:00+03:00";

const cutoffSources = [
  { key: "stage2-actual-new-scientific-2026", file: "LimitE2026.htm", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2026.htm", system: "new" as const, group: "scientific" as const, maximumScore: 320, sha256: "f7076183bdb9491a36fdc0767fb2229e3198214e13fd39683409942574b10e47", expectedRows: 458 },
  { key: "stage2-actual-new-literary-2026", file: "LimitA2026.htm", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2026.htm", system: "new" as const, group: "literary" as const, maximumScore: 320, sha256: "4efd31274c06133e403cf90ddfaee0607b19d3dac889cdda07a3ca76729082a4", expectedRows: 230 },
  { key: "stage2-actual-old-scientific-2026", file: "LimitEO2026.htm", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitEO2026.htm", system: "old" as const, group: "scientific" as const, maximumScore: 410, sha256: "4ad15f6c8ff7ee547f66dd694f3565ab2af19f272f95fa06aa068af197c9f3dd", expectedRows: 396 },
  { key: "stage2-actual-old-literary-2026", file: "LimitAO2026.htm", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitAO2026.htm", system: "old" as const, group: "literary" as const, maximumScore: 410, sha256: "b25cf7baf465903215217cea09932f29d6a64f204ad8edf292702d7cc2854ecf", expectedRows: 262 },
] as const;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values: number[], probability: number) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

function metrics(rows: Array<{ actual: number; predicted: number }>) {
  const errors = rows.map((row) => Math.abs(row.actual - row.predicted));
  return {
    sampleSize: rows.length,
    mae: round(errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length)),
    medianAe: round(median(errors)),
    p80: round(quantile(errors, 0.8)),
    p90: round(quantile(errors, 0.9)),
    bias: round(rows.reduce((sum, row) => sum + row.actual - row.predicted, 0) / Math.max(1, rows.length)),
  };
}

function cleanHtmlLabel(value: string) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseCutoffs(html: string) {
  const rows: Array<{ label: string; score: number }> = [];
  const pattern = /<tr><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([0-9.]+)<\/td><\/tr>/giu;
  for (const match of html.matchAll(pattern)) {
    rows.push({ label: cleanHtmlLabel(match[1]), score: Number(match[2]) });
  }
  return rows;
}

/**
 * The official PDFs expose a small, repeatable bidi/OCR ordering defect where
 * Arabic definite articles containing hamza are emitted as `اإ` / `اأ`.
 * This is an exact artifact repair, not a fuzzy identity match.
 */
function repairPdfExtractionLabel(value: string) {
  return value.replace(/اإل/gu, "الإ").replace(/األ/gu, "الأ");
}

const aliasesByContext = new Map<string, Set<string>>();
for (const alias of predictionV2.aliases) {
  if (alias.status !== "resolved" || !alias.admissionOptionId || alias.validFromYear > 2026 || alias.validToYear < 2026) continue;
  const key = `${alias.branch}|${normalizeOfficialLabel(alias.officialLabel)}`;
  const ids = aliasesByContext.get(key) ?? new Set<string>();
  ids.add(alias.admissionOptionId);
  aliasesByContext.set(key, ids);
}
const optionsById = new Map(predictionV2.admissionOptions.map((option) => [option.id, option]));

function resolve(label: string, branch: Branch) {
  return [...(aliasesByContext.get(`${branch}|${normalizeOfficialLabel(label)}`) ?? [])];
}

function vacancySources(): Stage3Source[] {
  return (["scientific", "literary"] as const).map((group) => ({
    key: `stage3-2026-${group}-official`,
    publisher: stage3Raw.publisher,
    url: stage3Raw.sources[group].url,
    retrievedAt: stage3Raw.retrievedAt,
    sha256: stage3Raw.sources[group].sha256,
    rowCount: stage3Raw.sources[group].rowCount,
    officialArtifact: true,
  }));
}

function buildVacancies() {
  const classCounts = {
    publicUniversityRows: { scientific: 0, literary: 0 },
    publicTechnologicalRows: { scientific: 0, literary: 0 },
    publicInstituteRows: { scientific: 0, literary: 0 },
    privateOrHigherInstituteRows: { scientific: 0, literary: 0 },
    unknownRows: { scientific: 0, literary: 0 },
  };
  const rowsByOption = new Map<string, Stage3OfficialVacancy>();
  const rawPublicByBranch = new Map<Branch, number>([["science", 0], ["mathematics", 0], ["literary", 0]]);
  let unresolvedPublicRows = 0;
  let ambiguousPublicRows = 0;
  const unresolvedPublicLabels = new Map<string, number>();
  const newAliases = new Map<string, AliasRecordV2>();

  for (const group of ["scientific", "literary"] as const) {
    for (const rawOfficialNameArabic of stage3Raw.rows[group]) {
      const officialNameArabic = repairPdfExtractionLabel(rawOfficialNameArabic);
      const institutionClass = classifyInstitution(officialNameArabic);
      if (institutionClass === "public_university") classCounts.publicUniversityRows[group] += 1;
      else if (institutionClass === "public_technological_university") classCounts.publicTechnologicalRows[group] += 1;
      else if (institutionClass === "public_institute") classCounts.publicInstituteRows[group] += 1;
      else if (institutionClass === "private_or_higher_institute") classCounts.privateOrHigherInstituteRows[group] += 1;
      else classCounts.unknownRows[group] += 1;
      if (!isPublicCoreClass(institutionClass)) continue;

      const branches: Branch[] = group === "literary" ? ["literary"] : scientificBranchesForLabel(officialNameArabic);
      for (const branch of branches) {
        rawPublicByBranch.set(branch, (rawPublicByBranch.get(branch) ?? 0) + 1);
        const ids = resolve(officialNameArabic, branch);
        if (ids.length === 0) {
          unresolvedPublicRows += 1;
          const diagnosticKey = `${branch}|${officialNameArabic}`;
          unresolvedPublicLabels.set(diagnosticKey, (unresolvedPublicLabels.get(diagnosticKey) ?? 0) + 1);
          continue;
        }
        if (ids.length > 1) {
          ambiguousPublicRows += 1;
          continue;
        }
        const option = optionsById.get(ids[0]);
        if (!option) {
          unresolvedPublicRows += 1;
          continue;
        }
        const key = `${branch}|${option.id}`;
        rowsByOption.set(key, {
          id: stableId("stage3vacancy", `2026|3|new|${branch}|${option.id}`),
          year: 2026,
          stage: 3,
          educationSystem: "new",
          branch,
          admissionOptionId: option.id,
          officialNameArabic: option.canonicalNameArabic,
          institutionClass: option.institutionClass,
          requiresAptitudeTest: option.requiresAptitudeTest,
          requiresGenderCheck: /بنين|بنات/u.test(normalizeOfficialLabel(officialNameArabic)),
          sourceKey: `stage3-2026-${group}-official`,
        });
        const aliasKey = `${branch}|${normalizeOfficialLabel(officialNameArabic)}`;
        if (!predictionV2.aliases.some((alias) => alias.branch === branch && alias.normalizedLabel === normalizeOfficialLabel(officialNameArabic))) {
          newAliases.set(aliasKey, {
            id: stableId("alias", aliasKey),
            officialLabel: officialNameArabic,
            normalizedLabel: normalizeOfficialLabel(officialNameArabic),
            canonicalLabel: option.canonicalNameArabic,
            admissionOptionId: option.id,
            branch,
            validFromYear: 2026,
            validToYear: 2026,
            status: "resolved",
            rule: "year_variant",
            notes: "Official Stage-3 2026 vacancy label",
          });
        }
      }
    }
  }
  const resolvedOptionsByBranch = Object.fromEntries(
    (["science", "mathematics", "literary"] as const).map((branch) => [
      branch,
      [...rowsByOption.values()].filter((row) => row.branch === branch).length,
    ]),
  ) as Record<Branch, number>;
  const duplicateVariantsByBranch = Object.fromEntries(
    (["science", "mathematics", "literary"] as const).map((branch) => [
      branch,
      (rawPublicByBranch.get(branch) ?? 0) - resolvedOptionsByBranch[branch],
    ]),
  ) as Record<Branch, number>;
  return {
    vacancies: [...rowsByOption.values()],
    aliases: [...newAliases.values()],
    diagnostics: {
      ...classCounts,
      resolvedOptionsByBranch,
      duplicateVariantsByBranch,
      unresolvedPublicRows,
      ambiguousPublicRows,
      unresolvedPublicLabels: Object.fromEntries(unresolvedPublicLabels),
    },
  };
}

async function buildActualCutoffs() {
  const rows: Stage2ActualCutoff[] = [];
  const sources: Stage3Source[] = [];
  for (const source of cutoffSources) {
    const response = await fetch(source.url, { headers: { "user-agent": "Masarak-Official-Data/1.0" } });
    if (!response.ok) throw new Error(`${source.key}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const actualHash = sha256(bytes);
    if (actualHash !== source.sha256) throw new Error(`${source.key}: source hash changed (${actualHash})`);
    const parsed = parseCutoffs(bytes.toString("utf8"));
    if (parsed.length !== source.expectedRows) throw new Error(`${source.key}: expected ${source.expectedRows}, got ${parsed.length}`);
    sources.push({ key: source.key, publisher: "Tansik — Ministry of Higher Education", url: source.url, retrievedAt: generatedAt, sha256: source.sha256, rowCount: parsed.length, officialArtifact: true });
    for (const cutoff of parsed) {
      const branches: Branch[] = source.group === "literary" ? ["literary"] : scientificBranchesForLabel(cutoff.label);
      for (const branch of branches) {
        const ids = resolve(cutoff.label, branch);
        const resolutionStatus = ids.length === 1 ? "resolved" : ids.length > 1 ? "ambiguous" : "rejected";
        const option = ids.length === 1 ? optionsById.get(ids[0]) : null;
        const institutionClass = option?.institutionClass ?? classifyInstitution(cutoff.label);
        rows.push({
          id: stableId("stage2actual", `2026|2|${source.system}|${branch}|${normalizeOfficialLabel(cutoff.label)}`),
          year: 2026,
          stage: 2,
          educationSystem: source.system,
          branch,
          admissionOptionId: option?.id ?? null,
          officialNameArabic: cutoff.label,
          minimumScore: cutoff.score,
          maximumScore: source.maximumScore,
          minimumPercentage: round((cutoff.score / source.maximumScore) * 100),
          institutionClass,
          resolutionStatus,
          sourceKey: source.key,
        });
      }
    }
  }
  return { rows, sources };
}

function basePrediction(history: Map<number, number>, sectorPrior: number | null) {
  const prior = new Map([...history].filter(([year]) => year < 2026));
  const level = robustRecentLevel(prior, 2026);
  if (level == null) return null;
  if (prior.size >= 3 || sectorPrior == null) return level;
  const weight = prior.size / (prior.size + predictionV2.model.sparseShrinkagePrior);
  return level * weight + sectorPrior * (1 - weight);
}

function buildCalibration(actuals: Stage2ActualCutoff[]) {
  const context = getPredictionV2RuntimeContextForTests(predictionV2);
  const stage2Options = new Set(predictionV2.stageVacancies.filter((row) => row.admissionOptionId).map((row) => `${row.branch}|${row.admissionOptionId}`));
  const sectorPriors = new Map<string, number>();
  for (const branch of ["science", "mathematics", "literary"] as const) {
    const grouped = new Map<string, number[]>();
    for (const [optionId, history] of context.histories) {
      const option = context.options.get(optionId);
      if (!option || option.branch !== branch) continue;
      const level = robustRecentLevel(history, 2026);
      if (level == null) continue;
      grouped.set(option.sector, [...(grouped.get(option.sector) ?? []), level]);
    }
    for (const [sector, values] of grouped) sectorPriors.set(`${branch}:${sector}`, median(values));
  }
  const evaluated: Array<{ id: string; branch: Branch; sector: string; actual: number; predicted: number; residual: number }> = [];
  for (const actual of actuals) {
    if (actual.educationSystem !== "new" || actual.resolutionStatus !== "resolved" || !actual.admissionOptionId || !stage2Options.has(`${actual.branch}|${actual.admissionOptionId}`)) continue;
    const option = context.options.get(actual.admissionOptionId);
    const history = context.histories.get(actual.admissionOptionId);
    if (!option || !history || [...history.keys()].filter((year) => year < 2026).length < 2) continue;
    const predicted = basePrediction(history, sectorPriors.get(`${actual.branch}:${option.sector}`) ?? null);
    if (predicted == null) continue;
    evaluated.push({ id: actual.id, branch: actual.branch, sector: option.sector, actual: actual.minimumPercentage, predicted, residual: actual.minimumPercentage - predicted });
  }
  const cells: Stage3Seed["calibrationCells"] = {};
  for (const branch of ["science", "mathematics", "literary"] as const) {
    const branchRows = evaluated.filter((row) => row.branch === branch);
    const branchMedian = median(branchRows.map((row) => row.residual));
    const branchWeight = branchRows.length / (branchRows.length + 8);
    const sectors = new Set(branchRows.map((row) => row.sector));
    for (const sector of sectors) {
      const cellRows = branchRows.filter((row) => row.sector === sector);
      const cellWeight = cellRows.length / (cellRows.length + 8);
      const adjustment = median(cellRows.map((row) => row.residual)) * cellWeight + branchMedian * branchWeight * (1 - cellWeight);
      cells[`${branch}:${sector}`] = { sampleSize: cellRows.length, adjustment: round(Math.max(-3, Math.min(3, adjustment))), residualP80: round(quantile(cellRows.map((row) => Math.abs(row.residual)), 0.8)) };
    }
  }
  const calibratedLeaveOneOut = evaluated.map((row) => {
    const branchPeers = evaluated.filter((peer) => peer.id !== row.id && peer.branch === row.branch);
    const cellPeers = branchPeers.filter((peer) => peer.sector === row.sector);
    const branchWeight = branchPeers.length / (branchPeers.length + 8);
    const cellWeight = cellPeers.length / (cellPeers.length + 8);
    const adjustment = median(cellPeers.map((peer) => peer.residual)) * cellWeight + median(branchPeers.map((peer) => peer.residual)) * branchWeight * (1 - cellWeight);
    return { actual: row.actual, predicted: row.predicted + Math.max(-3, Math.min(3, adjustment)) };
  });
  return { cells, sampleSize: evaluated.length, baseline: metrics(evaluated), calibratedLeaveOneOut: metrics(calibratedLeaveOneOut) };
}

async function main() {
  const vacancies = buildVacancies();
  const actuals = await buildActualCutoffs();
  const calibration = buildCalibration(actuals.rows);
  const payloadWithoutHash = {
    schemaVersion: "stage3-2026-data@1" as const,
    generatedAt,
    model: { version: "stage3-2026-v1" as const, stage: 3 as const, mode: "normalized_percentage" as const, calibrationCap: 3, calibrationPrior: 8, minimumIntervalHalfWidth: 2, closestDisplayCap: 20, ambitiousDisplayCap: 12, redDisplayCap: 5, conditionalDisplayCap: 12, relevanceBucketWidth: 1.5 },
    stageRules: (["science", "mathematics", "literary"] as const).flatMap((branch) => [
      { educationSystem: "new" as EducationSystem, branch, minimumScore: 160, maximumScore: 320, minimumPercentage: 50, officialVacancyArtifactAvailable: true },
      { educationSystem: "old" as EducationSystem, branch, minimumScore: 205, maximumScore: 410, minimumPercentage: 50, officialVacancyArtifactAvailable: false },
    ]),
    sources: [...vacancySources(), ...actuals.sources],
    stage2ActualCutoffs: actuals.rows,
    stage3Vacancies: vacancies.vacancies,
    aliases: vacancies.aliases,
    calibrationCells: calibration.cells,
    evaluation: { sampleSize: calibration.sampleSize, baseline: calibration.baseline, calibratedLeaveOneOut: calibration.calibratedLeaveOneOut },
    diagnostics: {
      rawVacancyRows: { scientific: stage3Raw.rows.scientific.length, literary: stage3Raw.rows.literary.length },
      ...vacancies.diagnostics,
      oldSystemVacancyArtifactAvailable: false as const,
    },
  };
  if (payloadWithoutHash.diagnostics.unresolvedPublicRows || payloadWithoutHash.diagnostics.ambiguousPublicRows) throw new Error(`Stage-3 public reconciliation blocked: ${JSON.stringify(payloadWithoutHash.diagnostics)}`);
  const expected = { science: 323, mathematics: 313, literary: 135 };
  if (JSON.stringify(payloadWithoutHash.diagnostics.resolvedOptionsByBranch) !== JSON.stringify(expected)) throw new Error(`Unexpected Stage-3 counts: ${JSON.stringify(payloadWithoutHash.diagnostics)}`);
  const dataHash = sha256(JSON.stringify(payloadWithoutHash));
  const payload: Stage3Seed = { ...payloadWithoutHash, dataHash };
  writeFileSync(outputPath, JSON.stringify(payload));
  console.log(JSON.stringify({ outputPath, dataHash, diagnostics: payload.diagnostics, evaluation: payload.evaluation }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

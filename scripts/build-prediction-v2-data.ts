import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import stage2V1Json from "../lib/coordination-data/stage2-2026.json";
import type { Branch, EducationSystem } from "../lib/grade-scales";
import {
  affiliationForLabel,
  canonicalizeExplicitAliases,
  classifyInstitution,
  findInstitution,
  inferGovernorate,
  institutionRules,
  isPublicCoreClass,
  normalizeOfficialLabel,
  optionIdentity,
  requiresAptitudeTest,
  scientificBranchesForLabel,
  sectorForLabel,
  stableId,
} from "../lib/prediction-v2/catalog";
import type {
  AdmissionOptionV2,
  AliasRecordV2,
  CanonicalInstitutionV2,
  CoordinationSourceV2,
  HistoricalObservationV2,
  OfficialCutoffV2,
  PhysicalFacultyV2,
  PredictionV2Seed,
  StageVacancyV2,
} from "../lib/prediction-v2/types";

const outputPath = path.resolve(
  process.cwd(),
  "lib",
  "coordination-data",
  "prediction-v2-2026.json",
);
const snapshotBuiltAt = "2026-08-12T12:00:00+03:00";

const stage2Sources = [
  {
    key: "stage2-2026-scientific-official",
    group: "scientific" as const,
    tier: "A" as const,
    publisher: "Ministry of Higher Education and Scientific Research (verified Facebook page)",
    url: "https://www.facebook.com/MOHESREGYPT/posts/1593853608764134/",
    // The official Facebook artifact is reconciled row-by-row. The stable mirror
    // remains the reproducible transport used by the generator.
    fetchUrl: "https://www.youm7.com/story/2026/8/11/تنسيق-المرحلة-الثانية-القائمة-الكامل-للكليات-والمعاهد-الشاغرة-أمام-الطلاب/7510195",
    expectedRows: 1029,
  },
  {
    key: "stage2-2026-literary-official",
    group: "literary" as const,
    tier: "A" as const,
    publisher: "Ministry of Higher Education and Scientific Research (verified Facebook page)",
    url: "https://www.facebook.com/MOHESREGYPT/posts/1593854832097345/",
    fetchUrl: "https://www.youm7.com/story/2026/8/10/الأماكن-الشاغرة-بتنسيق-المرحلة-الثانية-للثانوية-العامة-بالشعبة-الأدبية/7509321",
    expectedRows: 434,
  },
] as const;

const aptitude2026Source = {
  key: "aptitude-2026-official",
  tier: "A" as const,
  publisher: "Supreme Council of Universities",
  url: "https://scu.eg/en/download/student-guide-to-aptitude-tests-2026/",
  families: [
    "فنون جميلة (فنون)",
    "فنون جميلة (عمارة)",
    "فنون تطبيقية",
    "تربية فنية",
    "تربية موسيقية",
    "علوم الرياضة",
  ],
} as const;

const historicalSources = [
  ...[2021, 2022, 2023, 2024].flatMap((year) => [
    { year, group: "scientific" as const, url: `https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE${year}.htm`, maximumScore: 410, educationSystem: "old" as const },
    { year, group: "literary" as const, url: `https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA${year}.htm`, maximumScore: 410, educationSystem: "old" as const },
  ]),
  { year: 2025, group: "scientific" as const, url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2025.htm", maximumScore: 320, educationSystem: "new" as const },
  { year: 2025, group: "literary" as const, url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2025.htm", maximumScore: 320, educationSystem: "new" as const },
] as const;

type V1Seed = {
  stageRules: PredictionV2Seed["stageRules"];
  officialCutoffs: Array<{
    officialNameArabic: string;
    score: number;
    maximumScore: number;
    percentage: number;
    branch: Branch;
  }>;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&ndash;|&mdash;/giu, "-")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_match, value: string) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, value: string) => String.fromCodePoint(Number.parseInt(value, 16)));
}

function cleanHtmlLabel(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "Masarak-V2-Data-Audit/1.0" },
  });
  if (!response.ok) throw new Error(`Failed ${response.status}: ${url}`);
  return response.text();
}

function extractVacancyLines(html: string) {
  const paragraphs = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gisu)]
    .map((match) => match[1])
    .filter((paragraph) => /<br\s*\/?\s*>/iu.test(paragraph));
  const body = paragraphs.sort(
    (a, b) => (b.match(/<br\s*\/?\s*>/giu)?.length ?? 0) - (a.match(/<br\s*\/?\s*>/giu)?.length ?? 0),
  )[0];
  if (!body) throw new Error("Could not find the vacancy-list paragraph.");
  const lines = body
    .split(/<br\s*\/?\s*>/giu)
    .map(cleanHtmlLabel)
    .filter(Boolean);
  if (/وجاءت الأماكن/u.test(lines[0] ?? "")) lines.shift();
  return lines;
}

function extractHistoricalRows(html: string) {
  const rows: Array<{ officialNameArabic: string; minimumScore: number }> = [];
  const rowPattern = /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>([\d.]+)<\/td>\s*<\/tr>/gisu;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(html))) {
    const normalized = cleanHtmlLabel(match[1]);
    const nestedHeader = normalized.match(/.*الكلية\s+الحد\s+الأدن[ىي]\s+(.+)$/u);
    const officialNameArabic = (nestedHeader?.[1] ?? normalized).trim();
    const minimumScore = Number(match[2]);
    if (!officialNameArabic || officialNameArabic.length > 180 || !Number.isFinite(minimumScore)) continue;
    rows.push({ officialNameArabic, minimumScore });
  }
  return rows;
}

function addCanonicalEntities({
  label,
  branch,
  year,
  institutions,
  physicalFaculties,
  admissionOptions,
}: {
  label: string;
  branch: Branch;
  year: number;
  institutions: Map<string, CanonicalInstitutionV2>;
  physicalFaculties: Map<string, PhysicalFacultyV2>;
  admissionOptions: Map<string, AdmissionOptionV2>;
}) {
  const institutionClass = classifyInstitution(label);
  if (!isPublicCoreClass(institutionClass)) {
    return { status: "rejected" as const, optionId: null, institutionClass, notes: [] as string[] };
  }
  const match = findInstitution(label, institutionClass);
  if (!match.institution) {
    return {
      status: "ambiguous" as const,
      optionId: null,
      institutionClass,
      notes: [`No unique institution match (${match.candidates.join(", ") || "none"})`],
    };
  }
  const identity = optionIdentity(label, branch, match.institution.id);
  const governorate = inferGovernorate(label, match.institution.id);
  institutions.set(match.institution.id, {
    id: match.institution.id,
    officialNameArabic: match.institution.officialNameArabic,
    normalizedName: normalizeOfficialLabel(match.institution.officialNameArabic),
    institutionClass: match.institution.institutionClass,
    governorate: match.institution.governorate,
  });
  physicalFaculties.set(identity.physicalFacultyId, {
    id: identity.physicalFacultyId,
    institutionId: match.institution.id,
    canonicalNameArabic: identity.physicalName,
    normalizedName: normalizeOfficialLabel(identity.physicalName),
    sector: sectorForLabel(label),
    campus: governorate,
    governorate,
    institutionClass: match.institution.institutionClass,
  });
  admissionOptions.set(identity.optionId, {
    id: identity.optionId,
    physicalFacultyId: identity.physicalFacultyId,
    institutionId: match.institution.id,
    canonicalNameArabic: identity.canonicalLabel,
    normalizedName: normalizeOfficialLabel(identity.canonicalLabel),
    branch,
    affiliation: affiliationForLabel(label),
    requiresAptitudeTest: requiresAptitudeTest(label),
    sector: sectorForLabel(label),
    governorate,
    institutionClass: match.institution.institutionClass,
  });
  return {
    status: "resolved" as const,
    optionId: identity.optionId,
    institutionClass,
    notes: identity.notes,
  };
}

function upsertAlias(
  aliases: Map<string, AliasRecordV2>,
  row: Omit<AliasRecordV2, "id">,
) {
  const key = [
    row.branch,
    row.normalizedLabel,
    row.canonicalLabel,
    row.admissionOptionId ?? "unresolved",
    row.status,
    row.rule,
  ].join("|");
  const existing = aliases.get(key);
  aliases.set(key, {
    ...row,
    id: stableId("alias", key),
    validFromYear: Math.min(existing?.validFromYear ?? row.validFromYear, row.validFromYear),
    validToYear: Math.max(existing?.validToYear ?? row.validToYear, row.validToYear),
  });
}

async function main() {
  const sourceMetadata: CoordinationSourceV2[] = [];
  const institutions = new Map<string, CanonicalInstitutionV2>();
  const physicalFaculties = new Map<string, PhysicalFacultyV2>();
  const admissionOptions = new Map<string, AdmissionOptionV2>();
  const aliases = new Map<string, AliasRecordV2>();
  const stageVacancies = new Map<string, StageVacancyV2>();
  const separateInstitutes = new Map<string, PredictionV2Seed["separateInstitutes"][number]>();
  const excludedStage2Rows = new Map<string, PredictionV2Seed["excludedStage2Rows"][number]>();
  const rawStage2Rows = { scientific: 0, literary: 0 };
  const classCounts = {
    publicSourceRows: 0,
    publicTechnologicalRows: 0,
    publicInstituteRows: 0,
    privateOrHigherInstituteRows: 0,
    unknownRows: 0,
  };

  for (const source of stage2Sources) {
    const html = await fetchText(source.fetchUrl);
    const lines = extractVacancyLines(html);
    if (lines.length !== source.expectedRows) {
      throw new Error(`${source.key}: expected ${source.expectedRows} reconciled rows, received ${lines.length}`);
    }
    rawStage2Rows[source.group] = lines.length;
    sourceMetadata.push({
      key: source.key,
      tier: source.tier,
      publisher: source.publisher,
      url: source.url,
      retrievedAt: snapshotBuiltAt,
      sha256: sha256(lines.map(normalizeOfficialLabel).join("\n")),
      rowCount: lines.length,
      officialArtifact: true,
    });

    for (const officialNameArabic of lines) {
      const institutionClass = classifyInstitution(officialNameArabic);
      if (isPublicCoreClass(institutionClass)) {
        classCounts.publicSourceRows += 1;
        if (institutionClass === "public_technological_university") classCounts.publicTechnologicalRows += 1;
      } else if (institutionClass === "public_institute") {
        classCounts.publicInstituteRows += 1;
      } else if (institutionClass === "private_or_higher_institute") {
        classCounts.privateOrHigherInstituteRows += 1;
      } else {
        classCounts.unknownRows += 1;
      }

      const branches: Branch[] = source.group === "literary"
        ? ["literary"]
        : scientificBranchesForLabel(officialNameArabic);
      if (institutionClass === "public_institute") {
        for (const branch of branches) {
          separateInstitutes.set(`${branch}:${normalizeOfficialLabel(officialNameArabic)}`, {
            officialNameArabic,
            normalizedOfficialName: normalizeOfficialLabel(officialNameArabic),
            branch,
            institutionClass: "public_institute",
            sourceKey: source.key,
          });
        }
        continue;
      }
      if (!isPublicCoreClass(institutionClass)) {
        if (institutionClass === "private_or_higher_institute" || institutionClass === "unknown") {
          excludedStage2Rows.set(`${source.key}:${normalizeOfficialLabel(officialNameArabic)}`, {
            officialNameArabic,
            normalizedOfficialName: normalizeOfficialLabel(officialNameArabic),
            sourceKey: source.key,
            institutionClass,
            reason: institutionClass === "private_or_higher_institute"
              ? "out_of_scope_private_or_higher"
              : "unclassified_fail_closed",
          });
        }
        continue;
      }

      for (const branch of branches) {
        const entity = addCanonicalEntities({
          label: officialNameArabic,
          branch,
          year: 2026,
          institutions,
          physicalFaculties,
          admissionOptions,
        });
        const normalized = normalizeOfficialLabel(officialNameArabic);
        const vacancyId = stableId("vacancy", `2026|2|new|${branch}|${normalized}`);
        stageVacancies.set(`${branch}:${normalized}`, {
          id: vacancyId,
          year: 2026,
          stage: 2,
          educationSystem: "new",
          branch,
          admissionOptionId: entity.optionId,
          officialNameArabic,
          normalizedOfficialName: normalized,
          institutionClass,
          requiresAptitudeTest: requiresAptitudeTest(officialNameArabic),
          sourceKey: source.key,
          sourceTier: source.tier,
          resolutionStatus: entity.status,
        });
        upsertAlias(aliases, {
          officialLabel: officialNameArabic,
          normalizedLabel: normalized,
          canonicalLabel: canonicalizeExplicitAliases(officialNameArabic).canonical,
          admissionOptionId: entity.optionId,
          branch,
          validFromYear: 2026,
          validToYear: 2026,
          status: entity.status,
          rule: entity.status === "ambiguous" ? "ambiguous" : entity.notes.length ? "explicit_rename" : "exact",
          notes: entity.notes.join("; ") || null,
        });
      }
    }
  }

  sourceMetadata.push({
    key: aptitude2026Source.key,
    tier: aptitude2026Source.tier,
    publisher: aptitude2026Source.publisher,
    url: aptitude2026Source.url,
    retrievedAt: snapshotBuiltAt,
    sha256: sha256(aptitude2026Source.families.map(normalizeOfficialLabel).join("\n")),
    rowCount: aptitude2026Source.families.length,
    officialArtifact: true,
  });

  const historicalObservations: HistoricalObservationV2[] = [];
  let historicalRawRows = 0;
  for (const source of historicalSources) {
    const html = await fetchText(source.url);
    const rows = extractHistoricalRows(html);
    if (!rows.length) throw new Error(`No rows parsed from ${source.url}`);
    historicalRawRows += rows.length;
    const sourceKey = `historical-${source.year}-${source.group}`;
    const sourceHash = sha256(JSON.stringify(rows));
    sourceMetadata.push({
      key: sourceKey,
      tier: "A",
      publisher: "Tansik",
      url: source.url,
      retrievedAt: snapshotBuiltAt,
      sha256: sourceHash,
      rowCount: rows.length,
      officialArtifact: true,
    });
    for (const row of rows) {
      const institutionClass = classifyInstitution(row.officialNameArabic);
      const branches: Branch[] = source.group === "literary"
        ? ["literary"]
        : scientificBranchesForLabel(row.officialNameArabic);
      for (const branch of branches) {
        const entity = addCanonicalEntities({
          label: row.officialNameArabic,
          branch,
          year: source.year,
          institutions,
          physicalFaculties,
          admissionOptions,
        });
        const normalized = normalizeOfficialLabel(row.officialNameArabic);
        const observationId = stableId("observation", `${source.year}|${source.group}|${branch}|${normalized}`);
        historicalObservations.push({
          id: observationId,
          year: source.year,
          educationSystem: source.educationSystem as EducationSystem,
          branch,
          admissionOptionId: entity.optionId,
          officialNameArabic: row.officialNameArabic,
          minimumScore: row.minimumScore,
          maximumScore: source.maximumScore,
          minimumPercentage: Number(((row.minimumScore / source.maximumScore) * 100).toFixed(4)),
          sourceKey,
          institutionClass,
          resolutionStatus: entity.status,
        });
        if (isPublicCoreClass(institutionClass)) {
          upsertAlias(aliases, {
            officialLabel: row.officialNameArabic,
            normalizedLabel: normalized,
            canonicalLabel: canonicalizeExplicitAliases(row.officialNameArabic).canonical,
            admissionOptionId: entity.optionId,
            branch,
            validFromYear: source.year,
            validToYear: source.year,
            status: entity.status,
            rule: entity.status === "ambiguous" ? "ambiguous" : entity.notes.length ? "explicit_rename" : "year_variant",
            notes: entity.notes.join("; ") || null,
          });
        }
      }
    }
  }

  const v1 = stage2V1Json as unknown as V1Seed;
  const officialCutoffs: OfficialCutoffV2[] = [];
  for (const cutoff of v1.officialCutoffs) {
    const entity = addCanonicalEntities({
      label: cutoff.officialNameArabic,
      branch: cutoff.branch,
      year: 2026,
      institutions,
      physicalFaculties,
      admissionOptions,
    });
    officialCutoffs.push({
      id: stableId("official", `2026|1|${cutoff.branch}|${normalizeOfficialLabel(cutoff.officialNameArabic)}`),
      year: 2026,
      stage: 1,
      educationSystem: "new",
      branch: cutoff.branch,
      admissionOptionId: entity.optionId,
      officialNameArabic: cutoff.officialNameArabic,
      minimumScore: cutoff.score,
      maximumScore: cutoff.maximumScore,
      minimumPercentage: cutoff.percentage,
      sourceKey: cutoff.branch === "literary" ? "stage1-2026-literary" : "stage1-2026-scientific",
      resolutionStatus: entity.status,
    });
  }
  for (const group of ["scientific", "literary"] as const) {
    const url = group === "scientific"
      ? "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2026.htm"
      : "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2026.htm";
    const html = await fetchText(url);
    const parsedRows = extractHistoricalRows(html);
    sourceMetadata.push({
      key: `stage1-2026-${group}`,
      tier: "A",
      publisher: "Tansik",
      url,
      retrievedAt: snapshotBuiltAt,
      sha256: sha256(JSON.stringify(parsedRows)),
      rowCount: parsedRows.length,
      officialArtifact: true,
    });
  }

  const vacancyRows = [...stageVacancies.values()];
  const unresolvedPublicVacancies = vacancyRows.filter((row) => row.resolutionStatus !== "resolved").length;
  const ambiguousAliases = [...aliases.values()].filter((row) => row.status === "ambiguous").length;
  const activationBlockers: string[] = [];
  if (unresolvedPublicVacancies) {
    activationBlockers.push(`UNRESOLVED_PUBLIC_VACANCIES: ${unresolvedPublicVacancies} branch-specific public rows failed closed.`);
  }
  if (ambiguousAliases) {
    activationBlockers.push(`AMBIGUOUS_ALIASES: ${ambiguousAliases} contextual aliases require explicit review.`);
  }

  const baseOutput = {
    schemaVersion: "prediction-v2-data@1" as const,
    generatedAt: snapshotBuiltAt,
    model: {
      version: "stage2-2026-v2-shadow" as const,
      mode: "normalized_percentage" as const,
      shadow: true as const,
      activated: false as const,
      recentWeights: { "2025": 0.55, "2024": 0.3, "robust2021To2023": 0.15 },
      sparseShrinkagePrior: 2,
      calibrationMinimumSample: 8,
      calibrationShrinkagePrior: 8,
      calibrationEligibleCells: [],
      calibrationTransferGate: "blocked_missing_stage_level_holdouts" as const,
      minimumIntervalHalfWidth: 0.75,
      closestDisplayCap: 20,
      ambitiousDisplayCap: 12,
      stage3DisplayCap: 10,
      redDisplayCap: 5,
      relevanceBucketWidth: 1.5,
    },
    stageRules: v1.stageRules,
    sources: sourceMetadata.sort((a, b) => a.key.localeCompare(b.key)),
    institutions: [...institutions.values()].sort((a, b) => a.id.localeCompare(b.id)),
    physicalFaculties: [...physicalFaculties.values()].sort((a, b) => a.id.localeCompare(b.id)),
    admissionOptions: [...admissionOptions.values()].sort((a, b) => a.id.localeCompare(b.id)),
    aliases: [...aliases.values()].sort((a, b) => a.id.localeCompare(b.id)),
    historicalObservations: historicalObservations.sort((a, b) => a.id.localeCompare(b.id)),
    stageVacancies: vacancyRows.sort((a, b) => a.id.localeCompare(b.id)),
    officialCutoffs: officialCutoffs.sort((a, b) => a.id.localeCompare(b.id)),
    separateInstitutes: [...separateInstitutes.values()].sort((a, b) => `${a.branch}:${a.normalizedOfficialName}`.localeCompare(`${b.branch}:${b.normalizedOfficialName}`)),
    excludedStage2Rows: [...excludedStage2Rows.values()].sort((a, b) => `${a.sourceKey}:${a.normalizedOfficialName}`.localeCompare(`${b.sourceKey}:${b.normalizedOfficialName}`)),
    diagnostics: {
      rawStage2Rows,
      ...classCounts,
      resolvedPublicVacancies: vacancyRows.filter((row) => row.resolutionStatus === "resolved").length,
      unresolvedPublicVacancies,
      ambiguousAliases,
      historicalRawRows,
      historicalResolvedObservations: historicalObservations.filter((row) => row.resolutionStatus === "resolved" && isPublicCoreClass(row.institutionClass)).length,
      activationBlockers,
    },
  };
  const dataHash = sha256(JSON.stringify(baseOutput));
  const output: PredictionV2Seed = { ...baseOutput, dataHash };
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    dataHash,
    institutions: output.institutions.length,
    physicalFaculties: output.physicalFaculties.length,
    admissionOptions: output.admissionOptions.length,
    vacancies: output.stageVacancies.length,
    diagnostics: output.diagnostics,
    knownInstitutionRules: institutionRules.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

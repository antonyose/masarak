import { neon } from "@neondatabase/serverless";
import predictionV2SeedJson from "../lib/coordination-data/prediction-v2-2026.json";
import { runPredictionV2Backtests } from "../lib/prediction-v2/backtest";
import { normalizeOfficialLabel } from "../lib/prediction-v2/catalog";
import type { PredictionV2Seed } from "../lib/prediction-v2/types";

const seed = predictionV2SeedJson as unknown as PredictionV2Seed;

function chunks<T>(rows: T[], size = 400) {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }
  return output;
}

async function main() {
  if (!seed.model.shadow || seed.model.activated) {
    throw new Error("V2 seed must remain shadow-only and inactive.");
  }
  const evaluation = runPredictionV2Backtests(seed);
  const sourceByKey = new Map(seed.sources.map((source) => [source.key, source]));
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({
      dryRun: true,
      modelVersion: seed.model.version,
      activated: false,
      dataHash: seed.dataHash,
      gates: evaluation.gates,
      counts: {
        institutions: seed.institutions.length,
        physicalFaculties: seed.physicalFaculties.length,
        admissionOptions: seed.admissionOptions.length,
        aliases: seed.aliases.length,
        historicalObservations: seed.historicalObservations.length,
        stageVacancies: seed.stageVacancies.length,
      },
    }, null, 2));
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const sql = neon(databaseUrl);

  await sql`
    INSERT INTO model_versions (
      year, stage, version, mode, configuration_json, data_hash,
      calibration_metrics_json, backtest_metrics_json, activated_at
    ) VALUES (
      2026, 2, ${seed.model.version}, 'normalized_percentage',
      ${JSON.stringify({ ...seed.model, diagnostics: seed.diagnostics })}::jsonb,
      ${seed.dataHash},
      ${JSON.stringify(evaluation.validation2026)}::jsonb,
      ${JSON.stringify(evaluation)}::jsonb,
      NULL
    )
    ON CONFLICT (year, stage, version) DO NOTHING
  `;

  for (const source of seed.sources) {
    await sql`
      INSERT INTO coordination_import_batches_v2 (
        year, stage, model_version, source_key, source_tier, source_url,
        content_hash, official_artifact, row_count, diagnostics_json
      ) VALUES (
        ${source.key.startsWith("historical-") ? Number(source.key.split("-")[1]) : 2026},
        ${source.key.startsWith("stage2-") ? 2 : source.key.startsWith("stage1-") ? 1 : null},
        ${seed.model.version}, ${source.key}, ${source.tier}, ${source.url},
        ${source.sha256}, ${source.officialArtifact}, ${source.rowCount},
        ${JSON.stringify({ publisher: source.publisher, retrievedAt: source.retrievedAt })}::jsonb
      )
      ON CONFLICT (content_hash, source_key) DO UPDATE SET
        row_count = EXCLUDED.row_count,
        official_artifact = EXCLUDED.official_artifact,
        diagnostics_json = EXCLUDED.diagnostics_json
    `;
  }

  for (const batch of chunks(seed.institutions)) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, "officialNameArabic" text, "normalizedName" text,
          "institutionClass" coordination_institution_class, governorate text
        )
      )
      INSERT INTO coordination_institutions_v2 (
        id, official_name_arabic, normalized_name, institution_class, governorate
      )
      SELECT id, "officialNameArabic", "normalizedName", "institutionClass", governorate
      FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        official_name_arabic = EXCLUDED.official_name_arabic,
        normalized_name = EXCLUDED.normalized_name,
        institution_class = EXCLUDED.institution_class,
        governorate = EXCLUDED.governorate
    `;
  }

  for (const batch of chunks(seed.physicalFaculties)) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, "institutionId" text, "canonicalNameArabic" text,
          "normalizedName" text, sector text, campus text, governorate text,
          "institutionClass" coordination_institution_class
        )
      )
      INSERT INTO coordination_physical_faculties_v2 (
        id, institution_id, canonical_name_arabic, normalized_name, sector,
        campus, governorate, institution_class
      )
      SELECT id, "institutionId", "canonicalNameArabic", "normalizedName", sector,
        campus, governorate, "institutionClass"
      FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        canonical_name_arabic = EXCLUDED.canonical_name_arabic,
        normalized_name = EXCLUDED.normalized_name,
        sector = EXCLUDED.sector,
        campus = EXCLUDED.campus,
        governorate = EXCLUDED.governorate,
        institution_class = EXCLUDED.institution_class
    `;
  }

  for (const batch of chunks(seed.admissionOptions)) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, "physicalFacultyId" text, "canonicalNameArabic" text,
          "normalizedName" text, branch student_branch, affiliation text,
          "requiresAptitudeTest" boolean, sector text, governorate text,
          "institutionClass" coordination_institution_class
        )
      )
      INSERT INTO coordination_admission_options_v2 (
        id, physical_faculty_id, canonical_name_arabic, normalized_name, branch,
        affiliation, requires_aptitude_test, sector, governorate, institution_class
      )
      SELECT id, "physicalFacultyId", "canonicalNameArabic", "normalizedName", branch,
        affiliation, "requiresAptitudeTest", sector, governorate, "institutionClass"
      FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        canonical_name_arabic = EXCLUDED.canonical_name_arabic,
        normalized_name = EXCLUDED.normalized_name,
        affiliation = EXCLUDED.affiliation,
        requires_aptitude_test = EXCLUDED.requires_aptitude_test,
        sector = EXCLUDED.sector,
        governorate = EXCLUDED.governorate,
        institution_class = EXCLUDED.institution_class
    `;
  }

  for (const batch of chunks(seed.aliases)) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, "admissionOptionId" text, "officialLabel" text,
          "normalizedLabel" text, "canonicalLabel" text, branch student_branch,
          "validFromYear" integer, "validToYear" integer,
          status alias_resolution_status, rule text, notes text
        )
      )
      INSERT INTO coordination_aliases_v2 (
        id, admission_option_id, official_label, normalized_label, canonical_label,
        branch, valid_from_year, valid_to_year, status, rule, notes
      )
      SELECT id, "admissionOptionId", "officialLabel", "normalizedLabel", "canonicalLabel",
        branch, "validFromYear", "validToYear", status, rule, notes
      FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        admission_option_id = EXCLUDED.admission_option_id,
        canonical_label = EXCLUDED.canonical_label,
        status = EXCLUDED.status,
        rule = EXCLUDED.rule,
        notes = EXCLUDED.notes
    `;
  }

  for (const batch of chunks(seed.historicalObservations)) {
    const enrichedBatch = batch.map((row) => {
      const source = sourceByKey.get(row.sourceKey);
      if (!source) throw new Error(`Missing source metadata for ${row.sourceKey}`);
      return {
        ...row,
        normalizedOfficialName: normalizeOfficialLabel(row.officialNameArabic),
        sourceUrl: source.url,
        sourceSha256: source.sha256,
      };
    });
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(enrichedBatch)}::jsonb) AS x(
          id text, year integer, "educationSystem" education_system,
          branch student_branch, "admissionOptionId" text,
          "officialNameArabic" text, "normalizedOfficialName" text,
          "minimumScore" double precision, "maximumScore" double precision,
          "minimumPercentage" double precision, "sourceKey" text,
          "sourceUrl" text, "sourceSha256" text,
          "institutionClass" coordination_institution_class,
          "resolutionStatus" alias_resolution_status
        )
      )
      INSERT INTO coordination_historical_observations_v2 (
        id, year, education_system, branch, admission_option_id,
        official_name_arabic, normalized_official_name, minimum_score,
        maximum_score, minimum_percentage, source_key, source_url, source_hash,
        institution_class, resolution_status
      )
      SELECT id, year, "educationSystem", branch, "admissionOptionId",
        "officialNameArabic", "normalizedOfficialName", "minimumScore",
        "maximumScore", "minimumPercentage", "sourceKey", "sourceUrl", "sourceSha256",
        "institutionClass", "resolutionStatus"
      FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        admission_option_id = EXCLUDED.admission_option_id,
        minimum_score = EXCLUDED.minimum_score,
        maximum_score = EXCLUDED.maximum_score,
        minimum_percentage = EXCLUDED.minimum_percentage,
        source_hash = EXCLUDED.source_hash,
        resolution_status = EXCLUDED.resolution_status
    `;
  }

  const availabilityRows = [
    ...seed.stageVacancies.map((row) => ({
      ...row,
      availabilityState: "listed_stage_2",
    })),
    ...seed.officialCutoffs.map((row) => ({
      id: `closed_${row.id}`,
      year: row.year,
      stage: row.stage,
      educationSystem: row.educationSystem,
      branch: row.branch,
      admissionOptionId: row.admissionOptionId,
      officialNameArabic: row.officialNameArabic,
      normalizedOfficialName: normalizeOfficialLabel(row.officialNameArabic),
      institutionClass: seed.admissionOptions.find((option) => option.id === row.admissionOptionId)?.institutionClass ?? "public_university",
      availabilityState: "officially_closed",
      requiresAptitudeTest: seed.admissionOptions.find((option) => option.id === row.admissionOptionId)?.requiresAptitudeTest ?? false,
      sourceKey: row.sourceKey,
      sourceTier: "A",
      resolutionStatus: row.resolutionStatus,
    })),
  ];
  for (const batch of chunks(availabilityRows)) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, year integer, stage integer, "educationSystem" education_system,
          branch student_branch, "admissionOptionId" text,
          "officialNameArabic" text, "normalizedOfficialName" text,
          "institutionClass" coordination_institution_class,
          "availabilityState" coordination_availability_state,
          "requiresAptitudeTest" boolean, "sourceKey" text,
          "sourceTier" source_tier, "resolutionStatus" alias_resolution_status
        )
      )
      INSERT INTO coordination_availability_v2 (
        id, year, stage, education_system, branch, admission_option_id,
        official_name_arabic, normalized_official_name, institution_class,
        availability_state, requires_aptitude_test, source_key, source_tier,
        resolution_status
      )
      SELECT id, year, stage, "educationSystem", branch, "admissionOptionId",
        "officialNameArabic", "normalizedOfficialName", "institutionClass",
        "availabilityState", "requiresAptitudeTest", "sourceKey", "sourceTier",
        "resolutionStatus"
      FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        admission_option_id = EXCLUDED.admission_option_id,
        availability_state = EXCLUDED.availability_state,
        requires_aptitude_test = EXCLUDED.requires_aptitude_test,
        resolution_status = EXCLUDED.resolution_status
    `;
  }

  await sql`
    INSERT INTO model_evaluation_runs_v2 (
      model_version, data_hash, metrics_json, gates_json
    ) VALUES (
      ${seed.model.version}, ${seed.dataHash}, ${JSON.stringify(evaluation)}::jsonb,
      ${JSON.stringify(evaluation.gates)}::jsonb
    )
    ON CONFLICT (model_version, data_hash) DO UPDATE SET
      metrics_json = EXCLUDED.metrics_json,
      gates_json = EXCLUDED.gates_json
  `;

  console.log(JSON.stringify({
    modelVersion: seed.model.version,
    activated: false,
    activationReady: evaluation.gates.activationReady,
    blockers: evaluation.gates.blockers,
    counts: {
      institutions: seed.institutions.length,
      physicalFaculties: seed.physicalFaculties.length,
      admissionOptions: seed.admissionOptions.length,
      aliases: seed.aliases.length,
      historicalObservations: seed.historicalObservations.length,
      availabilityRows: availabilityRows.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

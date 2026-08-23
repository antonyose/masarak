import { neon } from "@neondatabase/serverless";
import stage3Json from "../lib/coordination-data/stage3-2026.json";
import { normalizeOfficialLabel } from "../lib/prediction-v2/catalog";
import type { Stage3Seed } from "../lib/prediction-stage3/types";

const seed = stage3Json as unknown as Stage3Seed;
const activate = process.argv.includes("--activate");
const dryRun = process.argv.includes("--dry-run");

function chunks<T>(rows: T[], size = 350) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

async function main() {
  if (seed.diagnostics.unresolvedPublicRows || seed.diagnostics.ambiguousPublicRows) {
    throw new Error("Stage-3 seed contains unresolved official public rows.");
  }
  const summary = {
    modelVersion: seed.model.version,
    dataHash: seed.dataHash,
    activate,
    sources: seed.sources.length,
    stage2Actuals: seed.stage2ActualCutoffs.length,
    stage3Vacancies: seed.stage3Vacancies.length,
    aliases: seed.aliases.length,
    branchCounts: seed.diagnostics.resolvedOptionsByBranch,
    evaluation: seed.evaluation,
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    INSERT INTO model_versions (
      year, stage, version, mode, configuration_json, data_hash,
      calibration_metrics_json, backtest_metrics_json, activated_at
    ) VALUES (
      2026, 3, ${seed.model.version}, 'normalized_percentage',
      ${JSON.stringify({ ...seed.model, diagnostics: seed.diagnostics, sources: seed.sources })}::jsonb,
      ${seed.dataHash}, ${JSON.stringify(seed.calibrationCells)}::jsonb,
      ${JSON.stringify(seed.evaluation)}::jsonb, ${activate ? new Date().toISOString() : null}
    )
    ON CONFLICT (year, stage, version) DO UPDATE SET
      configuration_json = EXCLUDED.configuration_json,
      calibration_metrics_json = EXCLUDED.calibration_metrics_json,
      backtest_metrics_json = EXCLUDED.backtest_metrics_json,
      activated_at = CASE WHEN ${activate} THEN now() ELSE model_versions.activated_at END
  `;

  for (const source of seed.sources) {
    await sql`
      INSERT INTO coordination_import_batches_v2 (
        year, stage, model_version, source_key, source_tier, source_url,
        content_hash, official_artifact, row_count, diagnostics_json
      ) VALUES (
        2026, ${source.key.startsWith("stage3-") ? 3 : 2}, ${seed.model.version},
        ${source.key}, 'A', ${source.url}, ${source.sha256}, ${source.officialArtifact},
        ${source.rowCount}, ${JSON.stringify({ publisher: source.publisher, retrievedAt: source.retrievedAt })}::jsonb
      )
      ON CONFLICT (content_hash, source_key) DO UPDATE SET
        row_count = EXCLUDED.row_count,
        diagnostics_json = EXCLUDED.diagnostics_json
    `;
  }

  for (const batch of chunks(seed.stage2ActualCutoffs)) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, year integer, stage integer, "educationSystem" education_system,
          branch student_branch, "admissionOptionId" text, "officialNameArabic" text,
          "minimumScore" double precision, "maximumScore" double precision,
          "minimumPercentage" double precision, "sourceKey" text,
          "institutionClass" coordination_institution_class,
          "resolutionStatus" alias_resolution_status
        )
      )
      INSERT INTO coordination_cutoff_observations_v2 (
        id, year, stage, education_system, branch, admission_option_id,
        official_name_arabic, minimum_score, maximum_score, minimum_percentage,
        source_key, institution_class, resolution_status
      )
      SELECT id, year, stage, "educationSystem", branch, "admissionOptionId",
        "officialNameArabic", "minimumScore", "maximumScore", "minimumPercentage",
        "sourceKey", "institutionClass", "resolutionStatus" FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        admission_option_id = EXCLUDED.admission_option_id,
        minimum_score = EXCLUDED.minimum_score,
        minimum_percentage = EXCLUDED.minimum_percentage,
        resolution_status = EXCLUDED.resolution_status
    `;
  }

  for (const batch of chunks(seed.stage3Vacancies.map((row) => ({
    ...row,
    normalizedOfficialName: normalizeOfficialLabel(row.officialNameArabic),
    availabilityState: "listed_stage_3",
    sourceTier: "A",
    resolutionStatus: "resolved",
  })))) {
    await sql`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          id text, year integer, stage integer, "educationSystem" education_system,
          branch student_branch, "admissionOptionId" text, "officialNameArabic" text,
          "normalizedOfficialName" text, "institutionClass" coordination_institution_class,
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
        "resolutionStatus" FROM incoming
      ON CONFLICT (id) DO UPDATE SET
        availability_state = EXCLUDED.availability_state,
        requires_aptitude_test = EXCLUDED.requires_aptitude_test
    `;
  }

  await sql`
    INSERT INTO model_evaluation_runs_v2 (model_version, data_hash, metrics_json, gates_json)
    VALUES (${seed.model.version}, ${seed.dataHash}, ${JSON.stringify(seed.evaluation)}::jsonb,
      ${JSON.stringify({ activationReady: true, blockers: [], officialVacancyOnly: true })}::jsonb)
    ON CONFLICT (model_version, data_hash) DO UPDATE SET
      metrics_json = EXCLUDED.metrics_json,
      gates_json = EXCLUDED.gates_json
  `;

  if (activate) {
    const [model] = await sql`SELECT id FROM model_versions WHERE year = 2026 AND stage = 3 AND version = ${seed.model.version}`;
    if (!model?.id) throw new Error("Stage-3 model insert failed.");
    await sql`
      UPDATE coordination_cycles SET current_stage = 3,
        active_model_version_id = ${model.id}, updated_at = now()
      WHERE year = 2026
    `;
    await sql`
      UPDATE payment_settings SET
        homepage_stage_message = 'المرحلة الثالثة 2026 — الشواغر الرسمية منشورة والاختيارات مرتبة حسب مجموعك',
        updated_at = now()
      WHERE id = 1
    `;
  }
  console.log(JSON.stringify({ applied: true, ...summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

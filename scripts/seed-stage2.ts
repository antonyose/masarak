import { createHash } from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
import stage2 from "../lib/coordination-data/stage2-2026.json";
import historical from "../lib/coordination-data/historical-cutoffs-2023-2025.json";
import { normalizeArabicName } from "../lib/normalize-arabic";
import { runStage2Backtests } from "../lib/stage2-backtest";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string) {
  return `tansik-${hash(value).slice(0, 20)}`;
}

function baseLabel(label: string) {
  return label.replace(/\s+(علوم|رياضة|رياضه)$/u, "").trim();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const backtests = runStage2Backtests();
  if (!backtests.activationReady) {
    throw new Error("New-system Stage-2 backtest gate did not pass.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const catalogUniversity = await client.query<{ id: number }>(`
      INSERT INTO universities (slug, name_arabic, governorate)
      VALUES ('tansik-catalog', 'سجل التنسيق الرسمي', 'غير محدد')
      ON CONFLICT (slug) DO UPDATE SET name_arabic = EXCLUDED.name_arabic
      RETURNING id
    `);
    const universityId = catalogUniversity.rows[0].id;

    const allLabels = new Map<string, string>();
    for (const row of [
      ...stage2.officialCutoffs,
      ...stage2.stageVacancies,
      ...historical.rows,
    ]) {
      allLabels.set(normalizeArabicName(row.officialNameArabic), row.officialNameArabic);
    }

    const aliasRows = await client.query<{
      name_normalized: string;
      faculty_id: number;
      faculty_normalized: string;
    }>(`SELECT a.name_normalized, a.faculty_id, f.normalized_name AS faculty_normalized
        FROM faculty_aliases a JOIN faculties f ON f.id = a.faculty_id`);
    const facultyMappings = new Map(
      aliasRows.rows.map((row) => [row.name_normalized, row]),
    );
    const facultyIds = new Map<string, number>();

    for (const [normalized, officialName] of allLabels) {
      const expectedFacultyNormalized = normalizeArabicName(baseLabel(officialName));
      const existingMapping = facultyMappings.get(normalized);
      if (existingMapping) {
        if (existingMapping.faculty_normalized !== expectedFacultyNormalized) {
          throw new Error(`Ambiguous faculty alias rejected: ${officialName}`);
        }
        facultyIds.set(normalized, existingMapping.faculty_id);
        continue;
      }
      const faculty = await client.query<{ id: number }>(`
        INSERT INTO faculties (
          university_id, slug, name_arabic, normalized_name, sector,
          governorate, requires_aptitude_test
        ) VALUES ($1, $2, $3, $4, NULL, 'غير محدد', $5)
        ON CONFLICT (slug) DO UPDATE SET name_arabic = EXCLUDED.name_arabic
        RETURNING id
      `, [
        universityId,
        slug(baseLabel(officialName)),
        baseLabel(officialName),
        normalizeArabicName(baseLabel(officialName)),
        /(فنون|تربية رياضية|علوم الرياضة)/u.test(officialName),
      ]);
      const facultyId = faculty.rows[0].id;
      await client.query(`
        INSERT INTO faculty_aliases (faculty_id, name_original, name_normalized)
        VALUES ($1, $2, $3)
        ON CONFLICT (name_normalized) DO NOTHING
      `, [facultyId, officialName, normalized]);
      const mapped = await client.query<{ faculty_id: number; faculty_normalized: string }>(
        `SELECT a.faculty_id, f.normalized_name AS faculty_normalized
         FROM faculty_aliases a JOIN faculties f ON f.id = a.faculty_id
         WHERE a.name_normalized = $1`,
        [normalized],
      );
      if (mapped.rows[0].faculty_normalized !== expectedFacultyNormalized) {
        throw new Error(`Ambiguous faculty alias rejected: ${officialName}`);
      }
      facultyIds.set(normalized, mapped.rows[0].faculty_id);
    }

    const sourceIds = new Map<string, string>();
    for (const source of stage2.sources) {
      const contentHash = hash(`${stage2.metadata.sourceSha256}:${source.key}`);
      const inserted = await client.query<{ id: string }>(`
        INSERT INTO coordination_sources (
          source_tier, publisher, url, retrieved_at, content_hash, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (content_hash) DO UPDATE SET notes = EXCLUDED.notes
        RETURNING id
      `, [
        source.tier,
        source.publisher,
        source.url,
        stage2.metadata.frozenAt,
        contentHash,
        source.key,
      ]);
      sourceIds.set(source.key, inserted.rows[0].id);
    }
    for (const source of historical.sources) {
      const key = `historical-${source.year}-${source.group}`;
      const inserted = await client.query<{ id: string }>(`
        INSERT INTO coordination_sources (
          source_tier, publisher, url, retrieved_at, content_hash, notes
        ) VALUES ('A', 'Tansik', $1, $2, $3, $4)
        ON CONFLICT (content_hash) DO UPDATE SET notes = EXCLUDED.notes
        RETURNING id
      `, [source.url, historical.generatedAt, source.sha256, key]);
      sourceIds.set(key, inserted.rows[0].id);
    }

    const modelDataHash = hash(JSON.stringify({
      stage2Source: stage2.metadata.sourceSha256,
      model: stage2.model,
      stageRules: stage2.stageRules,
      officialCutoffs: stage2.officialCutoffs,
      stageVacancies: stage2.stageVacancies,
      historicalSources: historical.sources.map((row) => row.sha256),
      historicalRows: historical.rows,
    }));
    const model = await client.query<{ id: string }>(`
      INSERT INTO model_versions (
        year, stage, version, mode, configuration_json, data_hash,
        calibration_metrics_json, backtest_metrics_json, activated_at
      ) VALUES (2026, 2, $1, 'normalized_percentage', $2::jsonb, $3,
        $4::jsonb, $5::jsonb, now())
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      stage2.model.version,
      JSON.stringify(stage2.model),
      modelDataHash,
      JSON.stringify(backtests.stage1_2026),
      JSON.stringify(backtests),
    ]);
    let modelId = model.rows[0]?.id;
    if (!modelId) {
      const existingModel = await client.query<{ id: string; data_hash: string }>(
        "SELECT id, data_hash FROM model_versions WHERE year = 2026 AND stage = 2 AND version = $1",
        [stage2.model.version],
      );
      if (!existingModel.rows[0] || existingModel.rows[0].data_hash !== modelDataHash) {
        throw new Error("Immutable model version collision: choose a new version for changed data.");
      }
      modelId = existingModel.rows[0].id;
    }

    const cycle = await client.query<{ id: string }>(`
      INSERT INTO coordination_cycles (
        year, current_stage, registration_opens_at, registration_closes_at,
        active_model_version_id
      ) VALUES (2026, 2, $1, $2, $3)
      ON CONFLICT (year) DO UPDATE SET
        current_stage = EXCLUDED.current_stage,
        registration_opens_at = EXCLUDED.registration_opens_at,
        registration_closes_at = EXCLUDED.registration_closes_at,
        active_model_version_id = EXCLUDED.active_model_version_id,
        updated_at = now()
      RETURNING id
    `, [
      stage2.metadata.registrationOpensAt,
      stage2.metadata.registrationClosesAt,
      modelId,
    ]);
    const cycleId = cycle.rows[0].id;
    const researchSourceId = sourceIds.get("research-context")!;

    await client.query(`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
          stage integer, education_system education_system, branch student_branch,
          minimum_score double precision, maximum_score double precision,
          minimum_percentage double precision, student_count integer
        )
      )
      INSERT INTO coordination_stage_rules (
        cycle_id, year, stage, education_system, branch, minimum_score,
        maximum_score, minimum_percentage, student_count, source_id
      )
      SELECT $2, 2026, stage, education_system, branch, minimum_score,
        maximum_score, minimum_percentage, student_count, $3
      FROM incoming
      ON CONFLICT (year, stage, education_system, branch) DO UPDATE SET
        minimum_score = EXCLUDED.minimum_score,
        maximum_score = EXCLUDED.maximum_score,
        minimum_percentage = EXCLUDED.minimum_percentage,
        student_count = EXCLUDED.student_count,
        source_id = EXCLUDED.source_id
    `, [
      JSON.stringify(
        stage2.stageRules.map((row) => ({
          stage: row.stage,
          education_system: row.educationSystem,
          branch: row.branch,
          minimum_score: row.minimumScore,
          maximum_score: row.maximumScore,
          minimum_percentage: row.minimumPercentage,
          student_count: row.studentCount,
        })),
      ),
      cycleId,
      researchSourceId,
    ]);

    const officialRows = stage2.officialCutoffs.map((row) => ({
      year: 2026,
      stage: 1,
      education_system: row.educationSystem,
      branch: row.branch,
      faculty_id: facultyIds.get(normalizeArabicName(row.officialNameArabic)),
      official_name_arabic: row.officialNameArabic,
      minimum_score: row.score,
      maximum_score: row.maximumScore,
      minimum_percentage: row.percentage,
      source_id: sourceIds.get(
        row.branch === "literary" ? "stage1-literary" : "stage1-scientific",
      ),
    }));
    await client.query(`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
          year integer, stage integer, education_system education_system,
          branch student_branch, faculty_id integer, official_name_arabic text,
          minimum_score double precision, maximum_score double precision,
          minimum_percentage double precision, source_id uuid
        )
      )
      INSERT INTO official_cutoffs (
        year, stage, education_system, branch, faculty_id, official_name_arabic,
        minimum_score, maximum_score, minimum_percentage, source_id
      ) SELECT year, stage, education_system, branch, faculty_id,
        official_name_arabic, minimum_score, maximum_score, minimum_percentage,
        source_id FROM incoming
      ON CONFLICT (year, stage, education_system, branch, faculty_id) DO UPDATE SET
        official_name_arabic = EXCLUDED.official_name_arabic,
        minimum_score = EXCLUDED.minimum_score,
        maximum_score = EXCLUDED.maximum_score,
        minimum_percentage = EXCLUDED.minimum_percentage,
        source_id = EXCLUDED.source_id
    `, [JSON.stringify(officialRows)]);

    const vacancyRows = stage2.stageVacancies.map((row) => ({
      year: 2026,
      stage: 2,
      education_system: row.educationSystem,
      branch: row.branch,
      faculty_id: facultyIds.get(normalizeArabicName(row.officialNameArabic)),
      official_name_arabic: row.officialNameArabic,
      requires_aptitude_test: row.requiresAptitudeTest,
      source_id: sourceIds.get(
        row.branch === "literary"
          ? "stage2-literary-vacancies"
          : "stage2-scientific-vacancies",
      ),
    }));
    await client.query(`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
          year integer, stage integer, education_system education_system,
          branch student_branch, faculty_id integer, official_name_arabic text,
          requires_aptitude_test boolean, source_id uuid
        )
      )
      INSERT INTO stage_vacancies (
        year, stage, education_system, branch, faculty_id, official_name_arabic,
        is_available, requires_aptitude_test, source_id
      ) SELECT year, stage, education_system, branch, faculty_id,
        official_name_arabic, true, requires_aptitude_test, source_id FROM incoming
      ON CONFLICT (year, stage, education_system, branch, faculty_id) DO UPDATE SET
        official_name_arabic = EXCLUDED.official_name_arabic,
        is_available = true,
        requires_aptitude_test = EXCLUDED.requires_aptitude_test,
        source_id = EXCLUDED.source_id
    `, [JSON.stringify(vacancyRows)]);

    const historicalRows = historical.rows.map((row) => ({
      year: row.year,
      education_system: row.educationSystem,
      branch: row.branch,
      faculty_id: facultyIds.get(normalizeArabicName(row.officialNameArabic)),
      minimum_score: row.minimumScore,
      maximum_score: row.maximumScore,
      minimum_percentage: row.minimumPercentage,
      source_url: row.sourceUrl,
    }));
    await client.query(`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
          year integer, education_system education_system, branch student_branch,
          faculty_id integer, minimum_score double precision,
          maximum_score double precision, minimum_percentage double precision,
          source_url text
        )
      )
      INSERT INTO historical_cutoffs (
        year, education_system, branch, faculty_id, minimum_score,
        maximum_score, minimum_percentage, source_url
      ) SELECT year, education_system, branch, faculty_id, minimum_score,
        maximum_score, minimum_percentage, source_url FROM incoming
      ON CONFLICT (year, education_system, branch, faculty_id) DO UPDATE SET
        minimum_score = EXCLUDED.minimum_score,
        maximum_score = EXCLUDED.maximum_score,
        minimum_percentage = EXCLUDED.minimum_percentage,
        source_url = EXCLUDED.source_url
    `, [JSON.stringify(historicalRows)]);

    await client.query(`
      INSERT INTO payment_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);
    const existingActivation = await client.query(
      "SELECT 1 FROM admin_audit_logs WHERE action = 'model_activated' AND target_id = $1 LIMIT 1",
      [modelId],
    );
    if (!existingActivation.rowCount) {
      await client.query(`
        INSERT INTO admin_audit_logs (
          action, target_type, target_id, after_json, request_id
        ) VALUES ('model_activated', 'model_version', $1, $2::jsonb, 'seed-stage2-2026')
      `, [modelId, JSON.stringify({ scope: backtests.activationScope, backtests })]);
    }

    await client.query("COMMIT");
    console.log(JSON.stringify({
      cycleId,
      modelId,
      active: true,
      scope: backtests.activationScope,
      officialCutoffs: officialRows.length,
      vacancies: vacancyRows.length,
      historicalCutoffs: historicalRows.length,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

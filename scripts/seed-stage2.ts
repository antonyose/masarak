import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
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

  const sql = neon(databaseUrl);

  const catalogUniversity = (await sql`
    INSERT INTO universities (slug, name_arabic, governorate)
    VALUES ('tansik-catalog', 'سجل التنسيق الرسمي', 'غير محدد')
    ON CONFLICT (slug) DO UPDATE SET name_arabic = EXCLUDED.name_arabic
    RETURNING id
  `) as Array<{ id: number }>;
  const universityId = catalogUniversity[0].id;

  const allLabels = new Map<string, string>();
  for (const row of [
    ...stage2.officialCutoffs,
    ...stage2.stageVacancies,
    ...historical.rows,
  ]) {
    allLabels.set(normalizeArabicName(row.officialNameArabic), row.officialNameArabic);
  }

  const uniqueFaculties = new Map<string, {
    university_id: number;
    slug: string;
    name_arabic: string;
    normalized_name: string;
    requires_aptitude_test: boolean;
  }>();

  for (const [normalized, officialName] of allLabels) {
    const baseName = baseLabel(officialName);
    const baseSlug = slug(baseName);
    if (!uniqueFaculties.has(baseSlug)) {
      uniqueFaculties.set(baseSlug, {
        university_id: universityId,
        slug: baseSlug,
        name_arabic: baseName,
        normalized_name: normalizeArabicName(baseName),
        requires_aptitude_test: /(فنون|تربية رياضية|علوم الرياضة)/u.test(officialName),
      });
    }
  }

  const facultyArray = Array.from(uniqueFaculties.values());
  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(facultyArray)}::jsonb) AS x(
        university_id integer, slug text, name_arabic text,
        normalized_name text, requires_aptitude_test boolean
      )
    )
    INSERT INTO faculties (
      university_id, slug, name_arabic, normalized_name, sector, governorate, requires_aptitude_test
    )
    SELECT university_id, slug, name_arabic, normalized_name, NULL, 'غير محدد', requires_aptitude_test
    FROM incoming
    ON CONFLICT (slug) DO UPDATE SET name_arabic = EXCLUDED.name_arabic
  `;

  const facultyDbRows = (await sql`SELECT id, slug, normalized_name FROM faculties`) as Array<{
    id: number;
    slug: string;
    normalized_name: string;
  }>;
  const facultyBySlug = new Map(facultyDbRows.map((f) => [f.slug, f]));

  const aliasArray: Array<{
    faculty_id: number;
    name_original: string;
    name_normalized: string;
  }> = [];

  for (const [normalized, officialName] of allLabels) {
    const baseName = baseLabel(officialName);
    const baseSlug = slug(baseName);
    const f = facultyBySlug.get(baseSlug);
    if (f) {
      aliasArray.push({
        faculty_id: f.id,
        name_original: officialName,
        name_normalized: normalized,
      });
    }
  }

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(aliasArray)}::jsonb) AS x(
        faculty_id integer, name_original text, name_normalized text
      )
    )
    INSERT INTO faculty_aliases (faculty_id, name_original, name_normalized)
    SELECT faculty_id, name_original, name_normalized FROM incoming
    ON CONFLICT (name_normalized) DO NOTHING
  `;

  const allAliasRows = (await sql`SELECT name_normalized, faculty_id FROM faculty_aliases`) as Array<{
    name_normalized: string;
    faculty_id: number;
  }>;
  const facultyIds = new Map(allAliasRows.map((a) => [a.name_normalized, a.faculty_id]));

  const sourceIds = new Map<string, string>();

  for (const source of stage2.sources) {
    const contentHash = hash(`${stage2.metadata.sourceSha256}:${source.key}`);
    const inserted = (await sql`
      INSERT INTO coordination_sources (
        source_tier, publisher, url, retrieved_at, content_hash, notes
      ) VALUES (${source.tier}, ${source.publisher}, ${source.url}, ${stage2.metadata.frozenAt}, ${contentHash}, ${source.key})
      ON CONFLICT (content_hash) DO UPDATE SET notes = EXCLUDED.notes
      RETURNING id
    `) as Array<{ id: string }>;
    sourceIds.set(source.key, inserted[0].id);
  }

  for (const source of historical.sources) {
    const key = `historical-${source.year}-${source.group}`;
    const inserted = (await sql`
      INSERT INTO coordination_sources (
        source_tier, publisher, url, retrieved_at, content_hash, notes
      ) VALUES ('A', 'Tansik', ${source.url}, ${historical.generatedAt}, ${source.sha256}, ${key})
      ON CONFLICT (content_hash) DO UPDATE SET notes = EXCLUDED.notes
      RETURNING id
    `) as Array<{ id: string }>;
    sourceIds.set(key, inserted[0].id);
  }

  const modelDataHash = hash(
    JSON.stringify({
      stage2Source: stage2.metadata.sourceSha256,
      model: stage2.model,
      stageRules: stage2.stageRules,
      officialCutoffs: stage2.officialCutoffs,
      stageVacancies: stage2.stageVacancies,
      historicalSources: historical.sources.map((row) => row.sha256),
      historicalRows: historical.rows,
    })
  );

  const model = (await sql`
    INSERT INTO model_versions (
      year, stage, version, mode, configuration_json, data_hash,
      calibration_metrics_json, backtest_metrics_json, activated_at
    ) VALUES (2026, 2, ${stage2.model.version}, 'normalized_percentage', ${JSON.stringify(stage2.model)}::jsonb, ${modelDataHash},
      ${JSON.stringify(backtests.stage1_2026)}::jsonb, ${JSON.stringify(backtests)}::jsonb, now())
    ON CONFLICT DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;

  let modelId = model[0]?.id;
  if (!modelId) {
    const existingModel = (await sql`
      SELECT id FROM model_versions WHERE year = 2026 AND stage = 2 AND version = ${stage2.model.version}
    `) as Array<{ id: string }>;
    modelId = existingModel[0].id;
  }

  const cycle = (await sql`
    INSERT INTO coordination_cycles (
      year, current_stage, registration_opens_at, registration_closes_at,
      active_model_version_id
    ) VALUES (2026, 2, ${stage2.metadata.registrationOpensAt}, ${stage2.metadata.registrationClosesAt}, ${modelId})
    ON CONFLICT (year) DO UPDATE SET
      current_stage = EXCLUDED.current_stage,
      registration_opens_at = EXCLUDED.registration_opens_at,
      registration_closes_at = EXCLUDED.registration_closes_at,
      active_model_version_id = EXCLUDED.active_model_version_id,
      updated_at = now()
    RETURNING id
  `) as Array<{ id: number }>;
  const cycleId = cycle[0].id;
  const researchSourceId = sourceIds.get("research-context");

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(
        stage2.stageRules.map((row) => ({
          stage: row.stage,
          education_system: row.educationSystem,
          branch: row.branch,
          minimum_score: row.minimumScore,
          maximum_score: row.maximumScore,
          minimum_percentage: row.minimumPercentage,
          student_count: row.studentCount,
        }))
      )}::jsonb) AS x(
        stage integer, education_system education_system, branch student_branch,
        minimum_score double precision, maximum_score double precision,
        minimum_percentage double precision, student_count integer
      )
    )
    INSERT INTO coordination_stage_rules (
      cycle_id, year, stage, education_system, branch, minimum_score,
      maximum_score, minimum_percentage, student_count, source_id
    )
    SELECT ${cycleId}, 2026, stage, education_system, branch, minimum_score,
      maximum_score, minimum_percentage, student_count, ${researchSourceId}
    FROM incoming
    ON CONFLICT (year, stage, education_system, branch) DO UPDATE SET
      minimum_score = EXCLUDED.minimum_score,
      maximum_score = EXCLUDED.maximum_score,
      minimum_percentage = EXCLUDED.minimum_percentage,
      student_count = EXCLUDED.student_count,
      source_id = EXCLUDED.source_id
  `;

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
      row.branch === "literary" ? "stage1-literary" : "stage1-scientific"
    ),
  }));

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(officialRows)}::jsonb) AS x(
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
  `;

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
        : "stage2-scientific-vacancies"
    ),
  }));

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(vacancyRows)}::jsonb) AS x(
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
  `;

  const historicalMap = new Map<string, {
    year: number;
    education_system: string;
    branch: string;
    faculty_id?: number;
    minimum_score: number;
    maximum_score: number;
    minimum_percentage: number;
    source_url: string;
  }>();

  for (const row of historical.rows) {
    const fid = facultyIds.get(normalizeArabicName(row.officialNameArabic));
    const key = `${row.year}:${row.educationSystem}:${row.branch}:${fid}`;
    historicalMap.set(key, {
      year: row.year,
      education_system: row.educationSystem,
      branch: row.branch,
      faculty_id: fid,
      minimum_score: row.minimumScore,
      maximum_score: row.maximumScore,
      minimum_percentage: row.minimumPercentage,
      source_url: row.sourceUrl,
    });
  }
  const historicalRows = Array.from(historicalMap.values());

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(historicalRows)}::jsonb) AS x(
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
  `;

  await sql`
    INSERT INTO payment_settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;

  const existingActivation = (await sql`
    SELECT 1 FROM admin_audit_logs WHERE action = 'model_activated' AND target_id = ${modelId} LIMIT 1
  `) as Array<unknown>;

  if (!existingActivation.length) {
    await sql`
      INSERT INTO admin_audit_logs (
        action, target_type, target_id, after_json, request_id
      ) VALUES ('model_activated', 'model_version', ${modelId}, ${JSON.stringify({ scope: backtests.activationScope, backtests })}::jsonb, 'seed-stage2-2026')
    `;
  }

  console.log("Seeding stage 2 completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

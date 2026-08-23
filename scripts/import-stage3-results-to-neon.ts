import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { Client } from "pg";

const batchSize = 5_000;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const postgres = new Client({ connectionString: process.env.DATABASE_URL });
  await postgres.connect();
  const sqlite = new DatabaseSync(path.resolve("data/private/results-2026-v2.sqlite"), { readOnly: true });
  try {
    const entitlementRows = await postgres.query<{ seat_number: string }>("SELECT seat_number FROM seat_entitlements WHERE year = 2026");
    await postgres.query("DROP INDEX IF EXISTS student_results_name_trgm_idx");
    const entitlementSeats = entitlementRows.rows.map((row) => row.seat_number);
    const placeholders = entitlementSeats.map(() => "?").join(",");
    const filter = `(year = 2026 AND education_system = 'new' AND total_score BETWEEN 160 AND 220)${placeholders ? ` OR (year = 2026 AND seat_number IN (${placeholders}))` : ""}`;
    const total = sqlite.prepare(`SELECT count(*) AS count FROM student_results WHERE ${filter}`).get(...entitlementSeats) as { count: number };
    let lastId = 0;
    let imported = 0;
    while (true) {
      const rows = sqlite.prepare(`
        SELECT id, year, education_system AS "educationSystem", branch, seat_number AS "seatNumber",
          student_name_original AS "studentNameOriginal", student_name_normalized AS "studentNameNormalized",
          total_score AS "totalScore", max_score AS "maxScore", percentage, result_status AS "resultStatus",
          school_name AS "schoolName", governorate
        FROM student_results
        WHERE id > ? AND (${filter})
        ORDER BY id
        LIMIT ?
      `).all(lastId, ...entitlementSeats, batchSize) as Array<Record<string, unknown>>;
      if (!rows.length) break;
      await postgres.query(`
        WITH incoming AS (
          SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
            id bigint, year integer, "educationSystem" education_system, branch student_branch,
            "seatNumber" text, "studentNameOriginal" text, "studentNameNormalized" text,
            "totalScore" double precision, "maxScore" double precision, percentage double precision,
            "resultStatus" text, "schoolName" text, governorate text
          )
        )
        INSERT INTO student_results (
          year, education_system, branch, seat_number, student_name_original, student_name_normalized,
          total_score, max_score, percentage, result_status, school_name, governorate,
          subject_marks, source_file, source_sheet
        )
        SELECT year, "educationSystem", branch, "seatNumber", "studentNameOriginal", "studentNameNormalized",
          "totalScore", "maxScore", percentage, "resultStatus", "schoolName", governorate,
          NULL, 'results-2026-v2.sqlite', 'stage3-eligible'
        FROM incoming
        ON CONFLICT (year, seat_number) DO UPDATE SET
          student_name_original = EXCLUDED.student_name_original,
          student_name_normalized = EXCLUDED.student_name_normalized,
          total_score = EXCLUDED.total_score,
          max_score = EXCLUDED.max_score,
          percentage = EXCLUDED.percentage,
          result_status = EXCLUDED.result_status,
          school_name = EXCLUDED.school_name,
          governorate = EXCLUDED.governorate
      `, [JSON.stringify(rows)]);
      lastId = Number(rows.at(-1)!.id);
      imported += rows.length;
      if (imported % 15_000 < batchSize) console.log(JSON.stringify({ imported, total: total.count }));
    }
    await postgres.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await postgres.query("CREATE INDEX IF NOT EXISTS student_results_name_trgm_idx ON student_results USING gin (student_name_normalized gin_trgm_ops)");
    console.log(JSON.stringify({ complete: true, imported, expected: total.count }));
  } finally {
    sqlite.close();
    await postgres.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

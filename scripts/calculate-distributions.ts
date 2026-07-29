import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 2,
    statement_timeout: 120_000,
  });
  const db = drizzle(pool);

  await db.transaction(async (transaction) => {
    await transaction.execute(sql`TRUNCATE TABLE score_distributions`);
    await transaction.execute(sql`
      INSERT INTO score_distributions (
        year,
        education_system,
        branch,
        score,
        students_at_score,
        students_above_score,
        students_at_or_above_score,
        total_successful_students,
        rank_percentile,
        max_score
      )
      WITH grouped AS (
        SELECT
          year,
          education_system,
          branch,
          total_score AS score,
          MAX(max_score) AS max_score,
          COUNT(*)::int AS students_at_score
        FROM student_results
        WHERE total_score IS NOT NULL
          AND max_score IS NOT NULL
          AND percentage IS NOT NULL
          AND COALESCE(result_status, 'ناجح') NOT ILIKE '%راسب%'
        GROUP BY year, education_system, branch, total_score
      ),
      ranked AS (
        SELECT
          *,
          COALESCE(
            SUM(students_at_score) OVER (
              PARTITION BY year, education_system, branch
              ORDER BY score DESC
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          )::int AS students_above_score,
          SUM(students_at_score) OVER (
            PARTITION BY year, education_system, branch
          )::int AS total_successful_students
        FROM grouped
      )
      SELECT
        year,
        education_system,
        branch,
        score,
        students_at_score,
        students_above_score,
        students_above_score + students_at_score,
        total_successful_students,
        students_above_score::double precision /
          NULLIF(total_successful_students, 0),
        max_score
      FROM ranked
    `);
  });

  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM score_distributions`,
  );
  console.log(`Calculated ${result.rows[0]?.count ?? 0} distribution points.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

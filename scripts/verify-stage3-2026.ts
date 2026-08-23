import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const sql = neon(process.env.DATABASE_URL);
  const [cycle] = await sql`
    SELECT c.current_stage, m.stage AS model_stage, m.version AS model_version
    FROM coordination_cycles c LEFT JOIN model_versions m ON m.id = c.active_model_version_id
    WHERE c.year = 2026
  `;
  const actuals = await sql`SELECT education_system, branch, count(*)::int AS count FROM coordination_cutoff_observations_v2 WHERE year = 2026 AND stage = 2 GROUP BY education_system, branch ORDER BY education_system, branch`;
  const vacancies = await sql`SELECT branch, count(*)::int AS count FROM coordination_availability_v2 WHERE year = 2026 AND stage = 3 AND availability_state = 'listed_stage_3' GROUP BY branch ORDER BY branch`;
  const [model] = await sql`SELECT version, stage, data_hash, activated_at FROM model_versions WHERE year = 2026 AND stage = 3 AND version = 'stage3-2026-v1'`;
  const [entitlements] = await sql`SELECT count(*)::int AS count, count(*) FILTER (WHERE scope = 'year_all_stages')::int AS year_all_stages FROM seat_entitlements WHERE year = 2026`;
  console.log(JSON.stringify({ cycle, model, actuals, vacancies, entitlements }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

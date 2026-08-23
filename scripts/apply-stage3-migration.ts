import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const sql = await readFile(path.resolve("drizzle/0015_stage3_2026.sql"), "utf8");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    const result = await client.query<{ enumlabel: string }>(
      "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'coordination_availability_state' ORDER BY enumsortorder",
    );
    console.log(JSON.stringify({ applied: true, availabilityStates: result.rows.map((row) => row.enumlabel) }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

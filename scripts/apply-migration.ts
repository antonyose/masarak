import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const migration = process.argv[2];
  if (!migration || !/^\d{4}_[a-z0-9_-]+\.sql$/.test(migration)) {
    throw new Error("Pass a migration filename such as 0014_discount_codes.sql");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const sql = await readFile(resolve("drizzle", migration), "utf8");
    await client.query(sql);
    console.log(`Applied ${migration}`);
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

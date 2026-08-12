import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

const STAGING_DB_URL = "postgresql://neondb_owner:npg_xzngKA0y2MYl@ep-lively-tooth-au1ghscb-pooler.c-10.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const PROD_DB_URL = "postgresql://neondb_owner:npg_2ATeyjxFVWE1@ep-snowy-butterfly-b1n4iynb-pooler.c-5.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function main() {
  const stagingClient = new Client({ connectionString: STAGING_DB_URL });
  const prodClient = new Client({ connectionString: PROD_DB_URL });

  await stagingClient.connect();
  await prodClient.connect();

  console.log("=== STEP 3: Applying Migration 0010 to STAGING ONLY (via pg) ===");
  const migrationFile = path.join(process.cwd(), "drizzle", "0010_prediction_v2_shadow.sql");
  const rawContent = fs.readFileSync(migrationFile, "utf-8");

  await stagingClient.query(rawContent);
  console.log("✓ Migration 0010 successfully executed on STAGING DB.");

  console.log("\n=== VERIFYING STAGING TABLES AFTER 0010 ===");
  const stagingTables = await stagingClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name LIKE '%v2' OR table_name = 'prediction_shadow_runs');
  `);
  console.log("Staging V2 Shadow tables count:", stagingTables.rows.length);
  console.log("Staging V2 Shadow tables:", stagingTables.rows.map((t: any) => t.table_name));

  console.log("\n=== MANDATORY ISOLATION SAFETY CHECK: PROD ISOLATION ===");
  const prodTables = await prodClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name LIKE '%v2' OR table_name = 'prediction_shadow_runs');
  `);
  console.log("Production V2/Shadow tables count:", prodTables.rows.length);
  if (prodTables.rows.length > 0) {
    console.error("CRITICAL ERROR: Production DB contains V2/shadow tables!", prodTables.rows);
    process.exit(1);
  }
  console.log("PROD IS SAFE: Zero 0010 tables exist on Production DB.");

  await stagingClient.end();
  await prodClient.end();
}

main().catch(console.error);

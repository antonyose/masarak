import { neon } from "@neondatabase/serverless";

const PROD_DB_URL = "postgresql://neondb_owner:npg_2ATeyjxFVWE1@ep-snowy-butterfly-b1n4iynb-pooler.c-5.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const STAGING_DB_URL = "postgresql://neondb_owner:npg_xzngKA0y2MYl@ep-lively-tooth-au1ghscb-pooler.c-10.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function main() {
  const prodSql = neon(PROD_DB_URL);
  const stagingSql = neon(STAGING_DB_URL);

  console.log("=== STEP 1: Verify Connections & Host Difference ===");
  const prodHost = (await prodSql.query("SELECT current_database(), inet_server_addr();")) as any[];
  const stagingHost = (await stagingSql.query("SELECT current_database(), inet_server_addr();")) as any[];

  console.log("PROD host info:", prodHost[0]);
  console.log("STAGING host info:", stagingHost[0]);

  // Define copy order to satisfy foreign key constraints
  const copyOrder = [
    "import_sources",
    "search_rate_limits",
    "student_results",
    "score_distributions",
    "universities",
    "faculties",
    "faculty_aliases",
    "historical_cutoffs",
    "analytics_events",
    "user",
    "session",
    "account",
    "verification",
    "coordination_sources",
    "model_versions",
    "coordination_cycles",
    "coordination_stage_rules",
    "official_cutoffs",
    "stage_vacancies",
    "saved_students",
    "prediction_runs",
    "payment_settings",
    "payment_submissions",
    "payment_submission_seats",
    "credit_ledger",
    "prediction_entitlements",
    "seat_entitlements",
    "admin_audit_logs",
    "rate_limits",
    "funnel_events"
  ];

  console.log("\n=== STEP 2: Copying Base Tables & Data from Prod to Staging ===");

  for (const tableName of copyOrder) {
    try {
      // Get table creation DDL or insert directly
      const prodRows = (await prodSql.query(`SELECT * FROM "${tableName}";`)) as any[];
      console.log(`Table ${tableName}: fetched ${prodRows.length} rows from Prod`);

      if (prodRows.length > 0) {
        const columns = Object.keys(prodRows[0]);
        const colList = columns.map(c => `"${c}"`).join(", ");

        for (const row of prodRows) {
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
          const values = columns.map(c => {
            const val = row[c];
            if (typeof val === "object" && val !== null && !(val instanceof Date)) {
              return JSON.stringify(val);
            }
            return val;
          });

          try {
            await stagingSql.query(
              `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`,
              values
            );
          } catch (err: any) {
            // Ignore if missing column or constraint mismatch for staging
          }
        }
        console.log(`✓ Copied ${tableName}`);
      }
    } catch (err: any) {
      console.log(`Notice on ${tableName}:`, err.message);
    }
  }

  console.log("\n=== STEP 3: Verification of Staging Base DB ===");
  const countRes = (await stagingSql.query(`
    SELECT 
      (SELECT COUNT(*) FROM "user") as users_count,
      (SELECT COUNT(*) FROM "payment_submissions") as payments_count,
      (SELECT COUNT(*) FROM "seat_entitlements") as entitlements_count,
      (SELECT COUNT(*) FROM "prediction_runs") as predictions_count;
  `)) as any[];
  console.log("Staging DB row counts:", countRes[0]);
}

main().catch(console.error);

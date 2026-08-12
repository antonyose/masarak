import { Client } from "pg";

const STAGING_DB_URL = "postgresql://neondb_owner:npg_xzngKA0y2MYl@ep-lively-tooth-au1ghscb-pooler.c-10.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const PROD_DB_URL = "postgresql://neondb_owner:npg_2ATeyjxFVWE1@ep-snowy-butterfly-b1n4iynb-pooler.c-5.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function verify() {
  const stagingClient = new Client({ connectionString: STAGING_DB_URL });
  const prodClient = new Client({ connectionString: PROD_DB_URL });

  await stagingClient.connect();
  await prodClient.connect();

  console.log("=== STEP 4 VERIFICATION: V2 SHADOW SEED IN STAGING ===");

  // 1. Check model_versions in Staging
  const modelsRes = await stagingClient.query(`
    SELECT version, activated_at, created_at 
    FROM model_versions 
    ORDER BY created_at DESC;
  `);
  console.log("Staging model versions:", modelsRes.rows);

  const v2Model = modelsRes.rows.find(m => m.version === "stage2-2026-v2-shadow");
  if (!v2Model) {
    throw new Error("V2 shadow model not found in Staging model_versions!");
  }
  if (v2Model.activated_at !== null) {
    throw new Error("CRITICAL SAFETY FAILURE: V2 model activated_at is NOT NULL!");
  }
  console.log("✓ V2 model activated_at is NULL (inactive as required).");

  // 2. Check active model in coordination_cycles
  const cyclesRes = await stagingClient.query(`
    SELECT cc.id, cc.year, mv.version as active_version
    FROM coordination_cycles cc
    JOIN model_versions mv ON cc.active_model_version_id = mv.id;
  `);
  console.log("Staging active model in coordination_cycles:", cyclesRes.rows);
  const activeVersion = cyclesRes.rows[0]?.active_version;
  if (activeVersion === "stage2-2026-v2-shadow") {
    throw new Error("CRITICAL SAFETY FAILURE: V2 is set as active_model_version_id in coordination_cycles!");
  }
  console.log(`✓ Active model version is V1 (${activeVersion || 'V1'}), V2 is INACTIVE.`);

  // 3. Count V2 tables
  const v2Counts = await stagingClient.query(`
    SELECT 
      (SELECT COUNT(*) FROM coordination_institutions_v2) as institutions,
      (SELECT COUNT(*) FROM coordination_physical_faculties_v2) as faculties,
      (SELECT COUNT(*) FROM coordination_admission_options_v2) as options,
      (SELECT COUNT(*) FROM coordination_aliases_v2) as aliases,
      (SELECT COUNT(*) FROM coordination_historical_observations_v2) as observations,
      (SELECT COUNT(*) FROM coordination_availability_v2) as availability;
  `);
  console.log("V2 Seeded Row Counts in Staging:", v2Counts.rows[0]);

  // 4. Production Safety Check
  const prodV2 = await prodClient.query(`
    SELECT * FROM model_versions WHERE version = 'stage2-2026-v2-shadow';
  `);
  console.log("Production V2 model count:", prodV2.rows.length);
  if (prodV2.rows.length > 0) {
    throw new Error("CRITICAL SAFETY FAILURE: V2 model found in Production DB!");
  }
  console.log("✓ PROD IS SAFE: V2 shadow model does not exist in Production DB.");

  await stagingClient.end();
  await prodClient.end();
}

verify().catch(console.error);

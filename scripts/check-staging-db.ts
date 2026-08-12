import { neon } from "@neondatabase/serverless";

const STAGING_DB_URL = "postgresql://neondb_owner:npg_xzngKA0y2MYl@ep-lively-tooth-au1ghscb-pooler.c-10.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function main() {
  const sql = neon(STAGING_DB_URL);
  console.log("Checking Staging DB connection...");
  const dbInfo = await sql.query("SELECT current_database(), current_user, version();");
  console.log("Staging DB info:", dbInfo);

  const tables = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
  console.log("Staging DB tables count:", tables.length);
  console.log("Staging DB tables:", tables.map((t: any) => t.table_name));
}
main().catch(console.error);

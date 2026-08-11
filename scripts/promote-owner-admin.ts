import pg from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const apply = process.argv.includes("--apply");
  const emailArgument = process.argv.find((value) => value.startsWith("--email="));
  const requestedEmail = emailArgument?.slice("--email=".length).trim().toLowerCase();
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const candidates = await pool.query<{
      id: string;
      email: string;
      role: "user" | "admin";
    }>(`
      SELECT DISTINCT u.id, lower(u.email) AS email, u.role
      FROM "user" u
      JOIN account a ON a.user_id = u.id
      WHERE a.provider_id = 'google'
      ORDER BY u.created_at ASC
    `);
    const selected = requestedEmail
      ? candidates.rows.find((row) => row.email === requestedEmail)
      : candidates.rows.length === 1
        ? candidates.rows[0]
        : null;
    if (!selected) {
      throw new Error(
        candidates.rows.length === 0
          ? "No existing Google owner account was found."
          : "Multiple Google accounts exist. Re-run with --email=<exact-existing-email>.",
      );
    }
    if (!apply) {
      console.log(
        `Resolved existing Google account ${selected.email}. Dry run only; add --apply to promote it.`,
      );
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE "user" SET role = 'admin', updated_at = now() WHERE id = $1`, [selected.id]);
      await client.query(`
        INSERT INTO admin_audit_logs (
          actor_user_id, action, target_type, target_id, before_json,
          after_json, request_id
        ) VALUES ($1, 'admin_role_changed', 'user', $1, $2::jsonb, $3::jsonb,
          'promote-owner-admin')
      `, [selected.id, JSON.stringify({ role: selected.role }), JSON.stringify({ role: "admin" })]);
      await client.query("COMMIT");
      console.log(`Promoted existing Google account ${selected.email} to admin.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

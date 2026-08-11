import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const apply = process.argv.includes("--apply");
  const emailArgument = process.argv.find((value) => value.startsWith("--email="));
  const requestedEmail = emailArgument?.slice("--email=".length).trim().toLowerCase();
  const sql = neon(databaseUrl);

  const candidates = await sql<{
    id: string;
    email: string;
    role: "user" | "admin";
    created_at: string;
  }>`
    SELECT DISTINCT u.id, lower(u.email) AS email, u.role, u.created_at
    FROM "user" u
    JOIN account a ON a.user_id = u.id
    WHERE a.provider_id = 'google'
    ORDER BY u.created_at ASC
  `;
  const selected = requestedEmail
    ? candidates.find((row) => row.email === requestedEmail)
    : candidates.length === 1
      ? candidates[0]
      : null;
  if (!selected) {
    throw new Error(
      candidates.length === 0
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
  await sql`UPDATE "user" SET role = 'admin', updated_at = now() WHERE id = ${selected.id}`;
  await sql`
    INSERT INTO admin_audit_logs (
      actor_user_id, action, target_type, target_id, before_json,
      after_json, request_id
    ) VALUES (${selected.id}, 'admin_role_changed', 'user', ${selected.id}, ${JSON.stringify({ role: selected.role })}::jsonb, ${JSON.stringify({ role: "admin" })}::jsonb, 'promote-owner-admin')
  `;
  console.log(`Promoted existing Google account ${selected.email} to admin.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

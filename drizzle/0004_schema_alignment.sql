-- 0002 creates this index during the reviewed auth-column alteration. Keeping
-- it in Drizzle metadata prevents future schema drift; IF NOT EXISTS makes the
-- alignment migration safe after 0002.
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" USING btree ("role");

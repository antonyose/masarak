ALTER TABLE "prediction_runs" ADD COLUMN IF NOT EXISTS "seat_number" text;
--> statement-breakpoint
UPDATE "prediction_runs" AS p
SET "seat_number" = s."seat_number"
FROM "saved_students" AS s
WHERE p."saved_student_id" = s."id"
  AND p."seat_number" IS NULL;
--> statement-breakpoint
ALTER TABLE "prediction_runs" ALTER COLUMN "seat_number" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "prediction_runs" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "prediction_runs" ALTER COLUMN "saved_student_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "prediction_runs" DROP CONSTRAINT IF EXISTS "prediction_runs_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "prediction_runs" DROP CONSTRAINT IF EXISTS "prediction_runs_saved_student_id_saved_students_id_fk";
--> statement-breakpoint
ALTER TABLE "prediction_runs"
  ADD CONSTRAINT "prediction_runs_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "prediction_runs"
  ADD CONSTRAINT "prediction_runs_saved_student_id_saved_students_id_fk"
  FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_runs_seat_created_idx"
  ON "prediction_runs" USING btree ("year", "seat_number", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_runs_seat_model_input_idx"
  ON "prediction_runs" USING btree ("year", "seat_number", "model_version_id", "input_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prediction_runs_guest_dedup_idx"
  ON "prediction_runs" USING btree ("year", "seat_number", "model_version_id", "input_hash")
  WHERE "user_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "payment_submissions" ADD COLUMN IF NOT EXISTS "year" integer;
--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD COLUMN IF NOT EXISTS "seat_number" text;
--> statement-breakpoint
UPDATE "payment_submissions" AS p
SET "year" = r."year", "seat_number" = r."seat_number"
FROM "prediction_runs" AS r
WHERE p."prediction_id" = r."id"
  AND (p."year" IS NULL OR p."seat_number" IS NULL);
--> statement-breakpoint
ALTER TABLE "payment_submissions" ALTER COLUMN "year" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_submissions" ALTER COLUMN "seat_number" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_submissions" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_submissions" ALTER COLUMN "saved_student_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_submissions" DROP CONSTRAINT IF EXISTS "payment_submissions_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_submissions" DROP CONSTRAINT IF EXISTS "payment_submissions_saved_student_id_saved_students_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_saved_student_id_saved_students_id_fk"
  FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_submissions_guest_idempotency_idx"
  ON "payment_submissions" USING btree ("year", "seat_number", "client_idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_submissions_seat_status_idx"
  ON "payment_submissions" USING btree ("year", "seat_number", "status", "created_at");
--> statement-breakpoint

ALTER TABLE "credit_ledger" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "saved_student_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_saved_student_id_saved_students_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_ledger"
  ADD CONSTRAINT "credit_ledger_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger"
  ADD CONSTRAINT "credit_ledger_saved_student_id_saved_students_id_fk"
  FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "seat_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer NOT NULL,
  "seat_number" text NOT NULL,
  "origin_prediction_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "scope" text DEFAULT 'year_all_stages' NOT NULL,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seat_entitlements"
  ADD CONSTRAINT "seat_entitlements_origin_prediction_id_prediction_runs_id_fk"
  FOREIGN KEY ("origin_prediction_id") REFERENCES "public"."prediction_runs"("id");
--> statement-breakpoint
ALTER TABLE "seat_entitlements"
  ADD CONSTRAINT "seat_entitlements_payment_id_payment_submissions_id_fk"
  FOREIGN KEY ("payment_id") REFERENCES "public"."payment_submissions"("id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seat_entitlements_year_seat_idx"
  ON "seat_entitlements" USING btree ("year", "seat_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seat_entitlements_payment_idx"
  ON "seat_entitlements" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seat_entitlements_seat_idx"
  ON "seat_entitlements" USING btree ("seat_number");
--> statement-breakpoint

INSERT INTO "seat_entitlements"
  ("year", "seat_number", "origin_prediction_id", "payment_id", "scope")
SELECT DISTINCT ON (p."year", p."seat_number")
  p."year", p."seat_number", p."id", pay."id", 'year_all_stages'
FROM "payment_submissions" AS pay
JOIN "prediction_runs" AS p ON p."id" = pay."prediction_id"
WHERE pay."status" = 'approved'
ORDER BY p."year", p."seat_number", pay."reviewed_at" ASC NULLS LAST, pay."created_at" ASC
ON CONFLICT ("year", "seat_number") DO NOTHING;

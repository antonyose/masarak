DO $$
BEGIN
  CREATE TYPE "public"."payment_product_type" AS ENUM ('single', 'friends_3');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "single_report_price_egp" numeric(10,2) NOT NULL DEFAULT 35.00;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "friends_3_price_egp" numeric(10,2) NOT NULL DEFAULT 69.00;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "friends_3_enabled" boolean NOT NULL DEFAULT true;
--> statement-breakpoint

ALTER TABLE "payment_submissions"
  ADD COLUMN IF NOT EXISTS "product_type" "public"."payment_product_type" NOT NULL DEFAULT 'single';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_submission_seats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_id" uuid NOT NULL,
  "year" integer NOT NULL,
  "seat_number" text NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_submission_seats_payment_id_payment_submissions_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment_submissions"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_submission_seats_payment_year_seat_idx"
  ON "payment_submission_seats" USING btree ("payment_id", "year", "seat_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_submission_seats_payment_position_idx"
  ON "payment_submission_seats" USING btree ("payment_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_submission_seats_year_seat_idx"
  ON "payment_submission_seats" USING btree ("year", "seat_number");
--> statement-breakpoint

INSERT INTO "payment_submission_seats" ("payment_id", "year", "seat_number", "position")
SELECT "id", "year", "seat_number", 1
FROM "payment_submissions"
ON CONFLICT ("payment_id", "year", "seat_number") DO NOTHING;
--> statement-breakpoint

DROP INDEX IF EXISTS "seat_entitlements_payment_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seat_entitlements_payment_idx"
  ON "seat_entitlements" USING btree ("payment_id");
--> statement-breakpoint
ALTER TABLE "seat_entitlements"
  ALTER COLUMN "origin_prediction_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "seat_entitlements"
  DROP CONSTRAINT IF EXISTS "seat_entitlements_origin_prediction_id_prediction_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "seat_entitlements"
  ADD CONSTRAINT "seat_entitlements_origin_prediction_id_prediction_runs_id_fk"
  FOREIGN KEY ("origin_prediction_id") REFERENCES "public"."prediction_runs"("id") ON DELETE SET NULL;

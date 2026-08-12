CREATE TABLE IF NOT EXISTS "admin_manual_entitlement_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer NOT NULL,
  "seat_number" text NOT NULL,
  "student_name_snapshot" text,
  "record_revenue" boolean DEFAULT false NOT NULL,
  "amount" numeric(10, 2) DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'EGP' NOT NULL,
  "method" "payment_method",
  "note" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "admin_manual_entitlement_grants_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict,
  CONSTRAINT "admin_manual_grants_revenue_amount_check"
    CHECK ((NOT "record_revenue" AND "amount" = 0) OR ("record_revenue" AND "amount" > 0)),
  CONSTRAINT "admin_manual_grants_revenue_method_check"
    CHECK ((NOT "record_revenue" AND "method" IS NULL) OR ("record_revenue" AND "method" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_manual_grants_year_seat_idx"
  ON "admin_manual_entitlement_grants" ("year", "seat_number");
CREATE INDEX IF NOT EXISTS "admin_manual_grants_revenue_created_idx"
  ON "admin_manual_entitlement_grants" ("record_revenue", "created_at");

ALTER TABLE "seat_entitlements" ALTER COLUMN "payment_id" DROP NOT NULL;
ALTER TABLE "seat_entitlements" ADD COLUMN IF NOT EXISTS "manual_grant_id" uuid;
DO $$ BEGIN
  ALTER TABLE "seat_entitlements"
    ADD CONSTRAINT "seat_entitlements_manual_grant_id_fk"
    FOREIGN KEY ("manual_grant_id") REFERENCES "public"."admin_manual_entitlement_grants"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "seat_entitlements_manual_grant_idx"
  ON "seat_entitlements" ("manual_grant_id");
DO $$ BEGIN
  ALTER TABLE "seat_entitlements"
    ADD CONSTRAINT "seat_entitlements_exactly_one_source_check"
    CHECK (("payment_id" IS NOT NULL) <> ("manual_grant_id" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

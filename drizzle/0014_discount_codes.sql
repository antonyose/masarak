DO $$ BEGIN
  ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'discount_code';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "discount_type" AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "discount_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "discount_type" "discount_type" NOT NULL,
  "discount_value" numeric(10,2) NOT NULL,
  "max_redemptions" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "expires_at" timestamp with time zone,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "discount_codes_value_check" CHECK (
    ("discount_type" = 'percentage' AND "discount_value" > 0 AND "discount_value" <= 100)
    OR ("discount_type" = 'fixed' AND "discount_value" > 0)
  ),
  CONSTRAINT "discount_codes_max_redemptions_check" CHECK ("max_redemptions" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_code_idx" ON "discount_codes" ("code");
CREATE INDEX IF NOT EXISTS "discount_codes_active_expiry_idx" ON "discount_codes" ("active", "expires_at");

ALTER TABLE "payment_submissions" ADD COLUMN IF NOT EXISTS "original_amount" numeric(10,2);
ALTER TABLE "payment_submissions" ADD COLUMN IF NOT EXISTS "discount_amount" numeric(10,2) DEFAULT '0.00' NOT NULL;
ALTER TABLE "payment_submissions" ADD COLUMN IF NOT EXISTS "discount_code_id" uuid REFERENCES "discount_codes"("id") ON DELETE set null;
UPDATE "payment_submissions" SET "original_amount" = "expected_amount" WHERE "original_amount" IS NULL;

CREATE TABLE IF NOT EXISTS "discount_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discount_code_id" uuid NOT NULL REFERENCES "discount_codes"("id"),
  "payment_id" uuid NOT NULL REFERENCES "payment_submissions"("id") ON DELETE cascade,
  "year" integer NOT NULL,
  "seat_number" text NOT NULL,
  "original_amount" numeric(10,2) NOT NULL,
  "discount_amount" numeric(10,2) NOT NULL,
  "final_amount" numeric(10,2) NOT NULL,
  "status" text DEFAULT 'reserved' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "redeemed_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  CONSTRAINT "discount_redemptions_status_check" CHECK ("status" IN ('reserved', 'redeemed', 'released'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "discount_redemptions_payment_idx" ON "discount_redemptions" ("payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "discount_redemptions_code_seat_idx" ON "discount_redemptions" ("discount_code_id", "year", "seat_number") WHERE "status" IN ('reserved', 'redeemed');
CREATE INDEX IF NOT EXISTS "discount_redemptions_code_status_idx" ON "discount_redemptions" ("discount_code_id", "status");

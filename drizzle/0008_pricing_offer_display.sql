ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "single_report_original_price_egp" numeric(10,2) NOT NULL DEFAULT 50.00;
--> statement-breakpoint
UPDATE "payment_settings"
SET "single_report_original_price_egp" = COALESCE("single_report_original_price_egp", 50.00)
WHERE "id" = 1;

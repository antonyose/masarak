ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "auto_accept_payments" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "payment_settings"."auto_accept_payments" IS
  'When enabled, a valid payment request is approved immediately without requiring a receipt. Every automatic approval remains audited.';

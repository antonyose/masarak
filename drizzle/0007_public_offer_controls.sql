ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_enabled" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_target_product" "public"."payment_product_type";
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_badge_text" text NOT NULL DEFAULT 'عرض لفترة محدودة';
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_title" text NOT NULL DEFAULT 'عرض التقرير الفردي';
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_subtitle" text NOT NULL DEFAULT 'افتح تقريرك الكامل بسعر خاص';
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_cta_text" text NOT NULL DEFAULT 'استفد من العرض';
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_end_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_show_countdown" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_show_in_header" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_show_in_pricing_card" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "offer_show_in_locked_offer" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
UPDATE "payment_settings"
SET "offer_target_product" = COALESCE("offer_target_product", 'single'::"public"."payment_product_type"),
    "offer_end_at" = COALESCE("offer_end_at", now() + interval '24 hours')
WHERE "id" = 1;

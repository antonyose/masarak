CREATE TYPE "public"."branch_source" AS ENUM('dataset', 'user_provided', 'official');--> statement-breakpoint
CREATE TYPE "public"."ledger_event_type" AS ENUM('grant', 'consume', 'refund', 'admin_adjustment');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('vodafone_cash', 'orange_cash', 'instapay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."prediction_mode" AS ENUM('rank_percentile', 'normalized_percentage');--> statement-breakpoint
CREATE TYPE "public"."source_tier" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"current_stage" integer NOT NULL,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"active_model_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_tier" "source_tier" NOT NULL,
	"publisher" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_stage_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"stage" integer NOT NULL,
	"education_system" "education_system" NOT NULL,
	"branch" "student_branch" NOT NULL,
	"minimum_score" double precision NOT NULL,
	"maximum_score" double precision NOT NULL,
	"minimum_percentage" double precision NOT NULL,
	"student_count" integer,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"saved_student_id" uuid NOT NULL,
	"prediction_id" uuid,
	"payment_id" uuid,
	"event_type" "ledger_event_type" NOT NULL,
	"units" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"stage" integer NOT NULL,
	"version" text NOT NULL,
	"mode" "prediction_mode" NOT NULL,
	"configuration_json" jsonb NOT NULL,
	"data_hash" text NOT NULL,
	"calibration_metrics_json" jsonb NOT NULL,
	"backtest_metrics_json" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "official_cutoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"stage" integer NOT NULL,
	"education_system" "education_system" NOT NULL,
	"branch" "student_branch" NOT NULL,
	"faculty_id" integer NOT NULL,
	"official_name_arabic" text NOT NULL,
	"minimum_score" double precision NOT NULL,
	"maximum_score" double precision NOT NULL,
	"minimum_percentage" double precision NOT NULL,
	"cutoff_rank_percentile" double precision,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"full_report_price_egp" numeric(10, 2) DEFAULT '99.00' NOT NULL,
	"vodafone_cash_number" text DEFAULT '01001014231' NOT NULL,
	"vodafone_deep_link" text DEFAULT 'http://vf.eg/vfcash?id=mt&qrId=hpSxBH' NOT NULL,
	"vodafone_enabled" boolean DEFAULT true NOT NULL,
	"orange_cash_number" text DEFAULT '01276101944' NOT NULL,
	"orange_enabled" boolean DEFAULT true NOT NULL,
	"instapay_identifier" text DEFAULT '01276101944' NOT NULL,
	"instapay_enabled" boolean DEFAULT true NOT NULL,
	"payment_instructions" text DEFAULT 'حوّل المبلغ ثم ارفع صورة واضحة لإيصال التحويل.' NOT NULL,
	"support_contact" text DEFAULT '+201276101944' NOT NULL,
	"free_recommendation_count" integer DEFAULT 1 NOT NULL,
	"homepage_stage_message" text DEFAULT 'توقعات تنسيق المرحلة الثانية 2026 — محدثة بعد ظهور نتيجة المرحلة الأولى رسميًا' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"saved_student_id" uuid NOT NULL,
	"prediction_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"expected_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"price_snapshot_json" jsonb NOT NULL,
	"sender_identifier" text NOT NULL,
	"transaction_reference" text,
	"receipt_blob_key" text,
	"receipt_sha256" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"rejection_reason" text,
	"client_idempotency_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"saved_student_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"origin_prediction_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"scope" text DEFAULT 'year_all_stages' NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"saved_student_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"coordination_stage" integer NOT NULL,
	"model_version_id" uuid NOT NULL,
	"model_mode" "prediction_mode" NOT NULL,
	"score" double precision NOT NULL,
	"percentage" double precision NOT NULL,
	"branch" "student_branch" NOT NULL,
	"governorate" text,
	"input_hash" text NOT NULL,
	"free_recommendation_count_snapshot" integer DEFAULT 1 NOT NULL,
	"result_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limits_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "saved_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"seat_number" text NOT NULL,
	"student_name_snapshot" text NOT NULL,
	"education_system" "education_system" NOT NULL,
	"score_snapshot" double precision NOT NULL,
	"max_score_snapshot" double precision NOT NULL,
	"percentage_snapshot" double precision NOT NULL,
	"branch" "student_branch" NOT NULL,
	"branch_source" "branch_source" NOT NULL,
	"result_status_snapshot" text,
	"result_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"stage" integer NOT NULL,
	"education_system" "education_system" NOT NULL,
	"branch" "student_branch" NOT NULL,
	"faculty_id" integer NOT NULL,
	"official_name_arabic" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"requires_aptitude_test" boolean DEFAULT false NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faculties" ADD COLUMN "requires_aptitude_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_cycles" ADD CONSTRAINT "coordination_cycles_active_model_version_id_model_versions_id_fk" FOREIGN KEY ("active_model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_stage_rules" ADD CONSTRAINT "coordination_stage_rules_cycle_id_coordination_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."coordination_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_stage_rules" ADD CONSTRAINT "coordination_stage_rules_source_id_coordination_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."coordination_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_saved_student_id_saved_students_id_fk" FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_prediction_id_prediction_runs_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."prediction_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_payment_id_payment_submissions_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_cutoffs" ADD CONSTRAINT "official_cutoffs_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_cutoffs" ADD CONSTRAINT "official_cutoffs_source_id_coordination_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."coordination_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_saved_student_id_saved_students_id_fk" FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_prediction_id_prediction_runs_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."prediction_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_entitlements" ADD CONSTRAINT "prediction_entitlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_entitlements" ADD CONSTRAINT "prediction_entitlements_saved_student_id_saved_students_id_fk" FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_entitlements" ADD CONSTRAINT "prediction_entitlements_origin_prediction_id_prediction_runs_id_fk" FOREIGN KEY ("origin_prediction_id") REFERENCES "public"."prediction_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_entitlements" ADD CONSTRAINT "prediction_entitlements_payment_id_payment_submissions_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_runs" ADD CONSTRAINT "prediction_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_runs" ADD CONSTRAINT "prediction_runs_saved_student_id_saved_students_id_fk" FOREIGN KEY ("saved_student_id") REFERENCES "public"."saved_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_runs" ADD CONSTRAINT "prediction_runs_model_version_id_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_students" ADD CONSTRAINT "saved_students_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_vacancies" ADD CONSTRAINT "stage_vacancies_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_vacancies" ADD CONSTRAINT "stage_vacancies_source_id_coordination_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."coordination_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_created_idx" ON "admin_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coordination_cycles_year_idx" ON "coordination_cycles" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "coordination_sources_content_hash_idx" ON "coordination_sources" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "coordination_sources_publisher_idx" ON "coordination_sources" USING btree ("publisher","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coordination_stage_rules_unique_idx" ON "coordination_stage_rules" USING btree ("year","stage","education_system","branch");--> statement-breakpoint
CREATE INDEX "coordination_stage_rules_cycle_idx" ON "coordination_stage_rules" USING btree ("cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idempotency_idx" ON "credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_payment_event_idx" ON "credit_ledger" USING btree ("payment_id","event_type");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "model_versions_year_stage_version_idx" ON "model_versions" USING btree ("year","stage","version");--> statement-breakpoint
CREATE UNIQUE INDEX "model_versions_data_hash_idx" ON "model_versions" USING btree ("data_hash");--> statement-breakpoint
CREATE INDEX "model_versions_stage_idx" ON "model_versions" USING btree ("year","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "official_cutoffs_unique_idx" ON "official_cutoffs" USING btree ("year","stage","education_system","branch","faculty_id");--> statement-breakpoint
CREATE INDEX "official_cutoffs_stage_branch_idx" ON "official_cutoffs" USING btree ("year","stage","education_system","branch");--> statement-breakpoint
CREATE INDEX "official_cutoffs_faculty_year_idx" ON "official_cutoffs" USING btree ("faculty_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_submissions_receipt_hash_idx" ON "payment_submissions" USING btree ("receipt_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_submissions_idempotency_idx" ON "payment_submissions" USING btree ("user_id","client_idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_submissions_status_submitted_idx" ON "payment_submissions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "payment_submissions_user_created_idx" ON "payment_submissions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_entitlements_student_year_idx" ON "prediction_entitlements" USING btree ("user_id","saved_student_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_entitlements_payment_idx" ON "prediction_entitlements" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_runs_dedup_idx" ON "prediction_runs" USING btree ("user_id","saved_student_id","model_version_id","input_hash");--> statement-breakpoint
CREATE INDEX "prediction_runs_user_created_idx" ON "prediction_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "prediction_runs_student_created_idx" ON "prediction_runs" USING btree ("saved_student_id","created_at");--> statement-breakpoint
CREATE INDEX "rate_limits_expires_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_students_user_year_seat_idx" ON "saved_students" USING btree ("user_id","year","seat_number");--> statement-breakpoint
CREATE INDEX "saved_students_user_created_idx" ON "saved_students" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_vacancies_unique_idx" ON "stage_vacancies" USING btree ("year","stage","education_system","branch","faculty_id");--> statement-breakpoint
CREATE INDEX "stage_vacancies_lookup_idx" ON "stage_vacancies" USING btree ("year","stage","education_system","branch","is_available");--> statement-breakpoint
ALTER TABLE "coordination_cycles" ADD CONSTRAINT "coordination_cycles_stage_check" CHECK ("current_stage" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "coordination_stage_rules" ADD CONSTRAINT "coordination_stage_rules_stage_check" CHECK ("stage" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_stage_check" CHECK ("stage" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "prediction_runs" ADD CONSTRAINT "prediction_runs_stage_check" CHECK ("coordination_stage" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_singleton_check" CHECK ("id" = 1);--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_price_check" CHECK ("full_report_price_egp" > 0);--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_free_count_check" CHECK ("free_recommendation_count" BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_amount_check" CHECK ("expected_amount" > 0);--> statement-breakpoint
INSERT INTO "payment_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

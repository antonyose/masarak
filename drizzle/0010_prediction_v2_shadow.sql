DO $$ BEGIN
  CREATE TYPE "coordination_institution_class" AS ENUM (
    'public_university',
    'public_technological_university',
    'public_institute',
    'private_or_higher_institute',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "alias_resolution_status" AS ENUM ('resolved', 'ambiguous', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "coordination_availability_state" AS ENUM (
    'listed_stage_2',
    'forecast_stage_3',
    'officially_closed',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_import_batches_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer NOT NULL,
  "stage" integer,
  "model_version" text NOT NULL,
  "source_key" text NOT NULL,
  "source_tier" "source_tier" NOT NULL,
  "source_url" text NOT NULL,
  "content_hash" text NOT NULL,
  "official_artifact" boolean DEFAULT false NOT NULL,
  "row_count" integer NOT NULL,
  "diagnostics_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coordination_import_batches_v2_hash_idx"
  ON "coordination_import_batches_v2" USING btree ("content_hash", "source_key");
CREATE INDEX IF NOT EXISTS "coordination_import_batches_v2_year_stage_idx"
  ON "coordination_import_batches_v2" USING btree ("year", "stage");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_institutions_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "official_name_arabic" text NOT NULL,
  "normalized_name" text NOT NULL,
  "institution_class" "coordination_institution_class" NOT NULL,
  "governorate" text,
  "valid_from_year" integer DEFAULT 2021 NOT NULL,
  "valid_to_year" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "coordination_institutions_v2_class_idx"
  ON "coordination_institutions_v2" USING btree ("institution_class");
CREATE INDEX IF NOT EXISTS "coordination_institutions_v2_name_idx"
  ON "coordination_institutions_v2" USING btree ("normalized_name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_physical_faculties_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "institution_id" text NOT NULL,
  "canonical_name_arabic" text NOT NULL,
  "normalized_name" text NOT NULL,
  "sector" text NOT NULL,
  "campus" text,
  "governorate" text,
  "institution_class" "coordination_institution_class" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coordination_physical_faculties_v2_institution_id_fk"
    FOREIGN KEY ("institution_id") REFERENCES "public"."coordination_institutions_v2"("id")
);
CREATE INDEX IF NOT EXISTS "coordination_physical_faculties_v2_institution_idx"
  ON "coordination_physical_faculties_v2" USING btree ("institution_id");
CREATE INDEX IF NOT EXISTS "coordination_physical_faculties_v2_sector_idx"
  ON "coordination_physical_faculties_v2" USING btree ("sector");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_admission_options_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "physical_faculty_id" text NOT NULL,
  "canonical_name_arabic" text NOT NULL,
  "normalized_name" text NOT NULL,
  "branch" "student_branch" NOT NULL,
  "affiliation" text DEFAULT 'regular' NOT NULL,
  "requires_aptitude_test" boolean DEFAULT false NOT NULL,
  "sector" text NOT NULL,
  "governorate" text,
  "institution_class" "coordination_institution_class" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coordination_admission_options_v2_physical_faculty_id_fk"
    FOREIGN KEY ("physical_faculty_id") REFERENCES "public"."coordination_physical_faculties_v2"("id")
);
CREATE INDEX IF NOT EXISTS "coordination_admission_options_v2_faculty_idx"
  ON "coordination_admission_options_v2" USING btree ("physical_faculty_id");
CREATE INDEX IF NOT EXISTS "coordination_admission_options_v2_branch_sector_idx"
  ON "coordination_admission_options_v2" USING btree ("branch", "sector");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_aliases_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "admission_option_id" text,
  "official_label" text NOT NULL,
  "normalized_label" text NOT NULL,
  "canonical_label" text NOT NULL,
  "branch" "student_branch" NOT NULL,
  "valid_from_year" integer NOT NULL,
  "valid_to_year" integer NOT NULL,
  "status" "alias_resolution_status" NOT NULL,
  "rule" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coordination_aliases_v2_admission_option_id_fk"
    FOREIGN KEY ("admission_option_id") REFERENCES "public"."coordination_admission_options_v2"("id") ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS "coordination_aliases_v2_context_idx"
  ON "coordination_aliases_v2" USING btree ("normalized_label", "branch", "valid_from_year", "valid_to_year");
CREATE INDEX IF NOT EXISTS "coordination_aliases_v2_status_idx"
  ON "coordination_aliases_v2" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_historical_observations_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "year" integer NOT NULL,
  "education_system" "education_system" NOT NULL,
  "branch" "student_branch" NOT NULL,
  "admission_option_id" text,
  "official_name_arabic" text NOT NULL,
  "normalized_official_name" text NOT NULL,
  "minimum_score" double precision NOT NULL,
  "maximum_score" double precision NOT NULL,
  "minimum_percentage" double precision NOT NULL,
  "source_key" text NOT NULL,
  "source_url" text NOT NULL,
  "source_hash" text NOT NULL,
  "institution_class" "coordination_institution_class" NOT NULL,
  "resolution_status" "alias_resolution_status" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coordination_historical_observations_v2_admission_option_id_fk"
    FOREIGN KEY ("admission_option_id") REFERENCES "public"."coordination_admission_options_v2"("id") ON DELETE set null
);
CREATE INDEX IF NOT EXISTS "coordination_historical_observations_v2_option_year_idx"
  ON "coordination_historical_observations_v2" USING btree ("admission_option_id", "year");
CREATE INDEX IF NOT EXISTS "coordination_historical_observations_v2_branch_year_idx"
  ON "coordination_historical_observations_v2" USING btree ("branch", "year");
CREATE INDEX IF NOT EXISTS "coordination_historical_observations_v2_resolution_idx"
  ON "coordination_historical_observations_v2" USING btree ("resolution_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coordination_availability_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "year" integer NOT NULL,
  "stage" integer NOT NULL,
  "education_system" "education_system" NOT NULL,
  "branch" "student_branch" NOT NULL,
  "admission_option_id" text,
  "official_name_arabic" text NOT NULL,
  "normalized_official_name" text NOT NULL,
  "institution_class" "coordination_institution_class" NOT NULL,
  "availability_state" "coordination_availability_state" NOT NULL,
  "requires_aptitude_test" boolean DEFAULT false NOT NULL,
  "source_key" text NOT NULL,
  "source_tier" "source_tier" NOT NULL,
  "resolution_status" "alias_resolution_status" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coordination_availability_v2_admission_option_id_fk"
    FOREIGN KEY ("admission_option_id") REFERENCES "public"."coordination_admission_options_v2"("id") ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS "coordination_availability_v2_context_idx"
  ON "coordination_availability_v2" USING btree (
    "year", "stage", "education_system", "branch", "normalized_official_name"
  );
CREATE INDEX IF NOT EXISTS "coordination_availability_v2_lookup_idx"
  ON "coordination_availability_v2" USING btree (
    "year", "stage", "education_system", "branch", "availability_state"
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_evaluation_runs_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_version" text NOT NULL,
  "data_hash" text NOT NULL,
  "metrics_json" jsonb NOT NULL,
  "gates_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "model_evaluation_runs_v2_model_hash_idx"
  ON "model_evaluation_runs_v2" USING btree ("model_version", "data_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prediction_shadow_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "production_prediction_run_id" uuid,
  "model_version_id" uuid,
  "model_version" text NOT NULL,
  "input_hash" text NOT NULL,
  "result_snapshot_json" jsonb NOT NULL,
  "diagnostics_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "prediction_shadow_runs_production_prediction_run_id_fk"
    FOREIGN KEY ("production_prediction_run_id") REFERENCES "public"."prediction_runs"("id") ON DELETE set null,
  CONSTRAINT "prediction_shadow_runs_model_version_id_fk"
    FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS "prediction_shadow_runs_dedup_idx"
  ON "prediction_shadow_runs" USING btree (
    "production_prediction_run_id", "model_version", "input_hash"
  );
CREATE INDEX IF NOT EXISTS "prediction_shadow_runs_model_created_idx"
  ON "prediction_shadow_runs" USING btree ("model_version", "created_at");

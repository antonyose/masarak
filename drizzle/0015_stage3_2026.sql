ALTER TYPE "public"."coordination_availability_state" ADD VALUE IF NOT EXISTS 'listed_stage_3';

CREATE TABLE IF NOT EXISTS "coordination_cutoff_observations_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "year" integer NOT NULL,
  "stage" integer NOT NULL,
  "education_system" "education_system" NOT NULL,
  "branch" "student_branch" NOT NULL,
  "admission_option_id" text,
  "official_name_arabic" text NOT NULL,
  "minimum_score" double precision NOT NULL,
  "maximum_score" double precision NOT NULL,
  "minimum_percentage" double precision NOT NULL,
  "source_key" text NOT NULL,
  "institution_class" "coordination_institution_class" NOT NULL,
  "resolution_status" "alias_resolution_status" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "coordination_cutoff_observations_v2" ADD CONSTRAINT "coordination_cutoff_observations_v2_admission_option_id_coordination_admission_options_v2_id_fk" FOREIGN KEY ("admission_option_id") REFERENCES "public"."coordination_admission_options_v2"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "coordination_cutoff_observations_v2_lookup_idx" ON "coordination_cutoff_observations_v2" USING btree ("year","stage","education_system","branch");
CREATE INDEX IF NOT EXISTS "coordination_cutoff_observations_v2_option_idx" ON "coordination_cutoff_observations_v2" USING btree ("admission_option_id");

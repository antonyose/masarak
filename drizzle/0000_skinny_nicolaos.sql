CREATE TYPE "public"."student_branch" AS ENUM('science', 'mathematics', 'literary', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."education_system" AS ENUM('new', 'old', 'unknown');--> statement-breakpoint
CREATE TABLE "faculties" (
	"id" serial PRIMARY KEY NOT NULL,
	"university_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name_arabic" text NOT NULL,
	"normalized_name" text NOT NULL,
	"sector" text,
	"governorate" text NOT NULL,
	CONSTRAINT "faculties_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "faculty_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"faculty_id" integer NOT NULL,
	"name_original" text NOT NULL,
	"name_normalized" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_cutoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"education_system" "education_system" NOT NULL,
	"branch" "student_branch" NOT NULL,
	"faculty_id" integer NOT NULL,
	"minimum_score" double precision NOT NULL,
	"maximum_score" double precision NOT NULL,
	"minimum_percentage" double precision NOT NULL,
	"cutoff_rank_percentile" double precision,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"sha256" text NOT NULL,
	"year" integer,
	"row_count" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_distributions" (
	"year" integer NOT NULL,
	"education_system" "education_system" NOT NULL,
	"branch" "student_branch" NOT NULL,
	"score" double precision NOT NULL,
	"students_at_score" integer NOT NULL,
	"students_above_score" integer NOT NULL,
	"students_at_or_above_score" integer NOT NULL,
	"total_successful_students" integer NOT NULL,
	"rank_percentile" double precision NOT NULL,
	"max_score" double precision NOT NULL,
	CONSTRAINT "score_distributions_pk" PRIMARY KEY("year","education_system","branch","score")
);
--> statement-breakpoint
CREATE TABLE "student_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"education_system" "education_system" DEFAULT 'unknown' NOT NULL,
	"branch" "student_branch" DEFAULT 'unknown' NOT NULL,
	"seat_number" text NOT NULL,
	"student_name_original" text NOT NULL,
	"student_name_normalized" text NOT NULL,
	"total_score" double precision,
	"max_score" double precision,
	"percentage" double precision,
	"result_status" text,
	"school_name" text,
	"governorate" text,
	"subject_marks" jsonb,
	"source_file" text NOT NULL,
	"source_sheet" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_arabic" text NOT NULL,
	"governorate" text NOT NULL,
	CONSTRAINT "universities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_aliases" ADD CONSTRAINT "faculty_aliases_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_cutoffs" ADD CONSTRAINT "historical_cutoffs_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faculties_university_idx" ON "faculties" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "faculties_sector_idx" ON "faculties" USING btree ("sector");--> statement-breakpoint
CREATE UNIQUE INDEX "faculty_aliases_normalized_idx" ON "faculty_aliases" USING btree ("name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_cutoffs_unique_idx" ON "historical_cutoffs" USING btree ("year","education_system","branch","faculty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_sources_sha256_idx" ON "import_sources" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "student_results_year_seat_number_idx" ON "student_results" USING btree ("year","seat_number");--> statement-breakpoint
CREATE INDEX "student_results_year_score_idx" ON "student_results" USING btree ("year","education_system","branch","total_score");--> statement-breakpoint
CREATE INDEX "student_results_year_system_idx" ON "student_results" USING btree ("year","education_system");--> statement-breakpoint
CREATE INDEX "universities_governorate_idx" ON "universities" USING btree ("governorate");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "student_results_name_trgm_idx" ON "student_results" USING gin ("student_name_normalized" gin_trgm_ops);

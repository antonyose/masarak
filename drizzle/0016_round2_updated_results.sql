CREATE TABLE IF NOT EXISTS "updated_student_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer DEFAULT 2026 NOT NULL,
  "seat_number" text NOT NULL,
  "updated_total_score" double precision NOT NULL,
  "updated_percentage" double precision NOT NULL,
  "max_score" double precision NOT NULL,
  "original_total_score" double precision,
  "original_percentage" double precision,
  "input_method" text DEFAULT 'score' NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "updated_student_results_year_seat_idx" ON "updated_student_results" ("year", "seat_number");
CREATE INDEX IF NOT EXISTS "updated_student_results_seat_idx" ON "updated_student_results" ("seat_number");

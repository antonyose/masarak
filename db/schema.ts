import {
  bigint,
  bigserial,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const educationSystemEnum = pgEnum("education_system", [
  "new",
  "old",
  "unknown",
]);
export const branchEnum = pgEnum("student_branch", [
  "science",
  "mathematics",
  "literary",
  "unknown",
]);

export const importSources = pgTable(
  "import_sources",
  {
    id: serial("id").primaryKey(),
    fileName: text("file_name").notNull(),
    sha256: text("sha256").notNull(),
    year: integer("year"),
    rowCount: integer("row_count").notNull().default(0),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("import_sources_sha256_idx").on(table.sha256)],
);

export const searchRateLimits = pgTable("search_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
  count: integer("count").notNull().default(1),
});

export const studentResults = pgTable(
  "student_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    year: integer("year").notNull(),
    educationSystem: educationSystemEnum("education_system")
      .notNull()
      .default("unknown"),
    branch: branchEnum("branch").notNull().default("unknown"),
    seatNumber: text("seat_number").notNull(),
    studentNameOriginal: text("student_name_original").notNull(),
    studentNameNormalized: text("student_name_normalized").notNull(),
    totalScore: doublePrecision("total_score"),
    maxScore: doublePrecision("max_score"),
    percentage: doublePrecision("percentage"),
    resultStatus: text("result_status"),
    schoolName: text("school_name"),
    governorate: text("governorate"),
    subjectMarks: jsonb("subject_marks").$type<Record<string, number> | null>(),
    sourceFile: text("source_file").notNull(),
    sourceSheet: text("source_sheet").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("student_results_year_seat_number_idx").on(
      table.year,
      table.seatNumber,
    ),
    index("student_results_year_score_idx").on(
      table.year,
      table.educationSystem,
      table.branch,
      table.totalScore,
    ),
    index("student_results_year_system_idx").on(
      table.year,
      table.educationSystem,
    ),
  ],
);

export const scoreDistributions = pgTable(
  "score_distributions",
  {
    year: integer("year").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    score: doublePrecision("score").notNull(),
    studentsAtScore: integer("students_at_score").notNull(),
    studentsAboveScore: integer("students_above_score").notNull(),
    studentsAtOrAboveScore: integer("students_at_or_above_score").notNull(),
    totalSuccessfulStudents: integer("total_successful_students").notNull(),
    rankPercentile: doublePrecision("rank_percentile").notNull(),
    maxScore: doublePrecision("max_score").notNull(),
  },
  (table) => [
    primaryKey({
      name: "score_distributions_pk",
      columns: [
        table.year,
        table.educationSystem,
        table.branch,
        table.score,
      ],
    }),
  ],
);

export const universities = pgTable(
  "universities",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    nameArabic: text("name_arabic").notNull(),
    governorate: text("governorate").notNull(),
  },
  (table) => [index("universities_governorate_idx").on(table.governorate)],
);

export const faculties = pgTable(
  "faculties",
  {
    id: serial("id").primaryKey(),
    universityId: integer("university_id")
      .notNull()
      .references(() => universities.id),
    slug: text("slug").notNull().unique(),
    nameArabic: text("name_arabic").notNull(),
    normalizedName: text("normalized_name").notNull(),
    sector: text("sector"),
    governorate: text("governorate").notNull(),
  },
  (table) => [
    index("faculties_university_idx").on(table.universityId),
    index("faculties_sector_idx").on(table.sector),
  ],
);

export const facultyAliases = pgTable(
  "faculty_aliases",
  {
    id: serial("id").primaryKey(),
    facultyId: integer("faculty_id")
      .notNull()
      .references(() => faculties.id, { onDelete: "cascade" }),
    nameOriginal: text("name_original").notNull(),
    nameNormalized: text("name_normalized").notNull(),
  },
  (table) => [
    uniqueIndex("faculty_aliases_normalized_idx").on(table.nameNormalized),
  ],
);

export const historicalCutoffs = pgTable(
  "historical_cutoffs",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    facultyId: integer("faculty_id")
      .notNull()
      .references(() => faculties.id, { onDelete: "cascade" }),
    minimumScore: doublePrecision("minimum_score").notNull(),
    maximumScore: doublePrecision("maximum_score").notNull(),
    minimumPercentage: doublePrecision("minimum_percentage").notNull(),
    cutoffRankPercentile: doublePrecision("cutoff_rank_percentile"),
    sourceUrl: text("source_url").notNull(),
  },
  (table) => [
    uniqueIndex("historical_cutoffs_unique_idx").on(
      table.year,
      table.educationSystem,
      table.branch,
      table.facultyId,
    ),
  ],
);

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull(),
  count: integer("count").notNull().default(0),
});


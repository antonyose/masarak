import {
  bigint,
  bigserial,
  boolean,
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

// Better Auth Schema
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});



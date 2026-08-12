import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const sourceTierEnum = pgEnum("source_tier", ["A", "B", "C"]);
export const predictionModeEnum = pgEnum("prediction_mode", [
  "rank_percentile",
  "normalized_percentage",
]);
export const branchSourceEnum = pgEnum("branch_source", [
  "dataset",
  "user_provided",
  "official",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "vodafone_cash",
  "orange_cash",
  "instapay",
]);
export const paymentProductTypeEnum = pgEnum("payment_product_type", [
  "single",
  "friends_3",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const ledgerEventTypeEnum = pgEnum("ledger_event_type", [
  "grant",
  "consume",
  "refund",
  "admin_adjustment",
]);
export const coordinationInstitutionClassEnum = pgEnum(
  "coordination_institution_class",
  [
    "public_university",
    "public_technological_university",
    "public_institute",
    "private_or_higher_institute",
    "unknown",
  ],
);
export const aliasResolutionStatusEnum = pgEnum("alias_resolution_status", [
  "resolved",
  "ambiguous",
  "rejected",
]);
export const coordinationAvailabilityStateEnum = pgEnum(
  "coordination_availability_state",
  ["listed_stage_2", "forecast_stage_3", "officially_closed", "unknown"],
);

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
    requiresAptitudeTest: boolean("requires_aptitude_test")
      .notNull()
      .default(false),
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

export const behaviorEvents = pgTable(
  "behavior_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventName: text("event_name").notNull(),
    sessionId: text("session_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    path: text("path"),
    product: text("product"),
    deviceType: text("device_type").notNull().default("unknown"),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("behavior_events_occurred_idx").on(table.occurredAt),
    index("behavior_events_name_occurred_idx").on(table.eventName, table.occurredAt),
    index("behavior_events_session_occurred_idx").on(table.sessionId, table.occurredAt),
  ],
);

// Better Auth Schema
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    phone: text("phone"),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_role_idx").on(table.role)],
);

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

export const coordinationSources = pgTable(
  "coordination_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceTier: sourceTierEnum("source_tier").notNull(),
    publisher: text("publisher").notNull(),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    contentHash: text("content_hash").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coordination_sources_content_hash_idx").on(table.contentHash),
    index("coordination_sources_publisher_idx").on(
      table.publisher,
      table.publishedAt,
    ),
  ],
);

export const modelVersions = pgTable(
  "model_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    stage: integer("stage").notNull(),
    version: text("version").notNull(),
    mode: predictionModeEnum("mode").notNull(),
    configurationJson: jsonb("configuration_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    dataHash: text("data_hash").notNull(),
    calibrationMetricsJson: jsonb("calibration_metrics_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    backtestMetricsJson: jsonb("backtest_metrics_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("model_versions_year_stage_version_idx").on(
      table.year,
      table.stage,
      table.version,
    ),
    uniqueIndex("model_versions_data_hash_idx").on(table.dataHash),
    index("model_versions_stage_idx").on(table.year, table.stage),
  ],
);

export const coordinationCycles = pgTable(
  "coordination_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    currentStage: integer("current_stage").notNull(),
    registrationOpensAt: timestamp("registration_opens_at", {
      withTimezone: true,
    }),
    registrationClosesAt: timestamp("registration_closes_at", {
      withTimezone: true,
    }),
    activeModelVersionId: uuid("active_model_version_id").references(
      () => modelVersions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("coordination_cycles_year_idx").on(table.year)],
);

export const coordinationStageRules = pgTable(
  "coordination_stage_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => coordinationCycles.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    stage: integer("stage").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    minimumScore: doublePrecision("minimum_score").notNull(),
    maximumScore: doublePrecision("maximum_score").notNull(),
    minimumPercentage: doublePrecision("minimum_percentage").notNull(),
    studentCount: integer("student_count"),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => coordinationSources.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coordination_stage_rules_unique_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
    ),
    index("coordination_stage_rules_cycle_idx").on(table.cycleId),
  ],
);

export const officialCutoffs = pgTable(
  "official_cutoffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    stage: integer("stage").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    facultyId: integer("faculty_id")
      .notNull()
      .references(() => faculties.id),
    officialNameArabic: text("official_name_arabic").notNull(),
    minimumScore: doublePrecision("minimum_score").notNull(),
    maximumScore: doublePrecision("maximum_score").notNull(),
    minimumPercentage: doublePrecision("minimum_percentage").notNull(),
    cutoffRankPercentile: doublePrecision("cutoff_rank_percentile"),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => coordinationSources.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("official_cutoffs_unique_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
      table.facultyId,
    ),
    index("official_cutoffs_stage_branch_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
    ),
    index("official_cutoffs_faculty_year_idx").on(
      table.facultyId,
      table.year,
    ),
  ],
);

export const stageVacancies = pgTable(
  "stage_vacancies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    stage: integer("stage").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    facultyId: integer("faculty_id")
      .notNull()
      .references(() => faculties.id),
    officialNameArabic: text("official_name_arabic").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    requiresAptitudeTest: boolean("requires_aptitude_test")
      .notNull()
      .default(false),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => coordinationSources.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stage_vacancies_unique_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
      table.facultyId,
    ),
    index("stage_vacancies_lookup_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
      table.isAvailable,
    ),
  ],
);

// Prediction V2 is additive and shadow-only. These tables do not replace the
// V1 universities/faculties/cutoffs/vacancies or immutable prediction runs.
export const coordinationImportBatchesV2 = pgTable(
  "coordination_import_batches_v2",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    stage: integer("stage"),
    modelVersion: text("model_version").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceTier: sourceTierEnum("source_tier").notNull(),
    sourceUrl: text("source_url").notNull(),
    contentHash: text("content_hash").notNull(),
    officialArtifact: boolean("official_artifact").notNull().default(false),
    rowCount: integer("row_count").notNull(),
    diagnosticsJson: jsonb("diagnostics_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coordination_import_batches_v2_hash_idx").on(
      table.contentHash,
      table.sourceKey,
    ),
    index("coordination_import_batches_v2_year_stage_idx").on(
      table.year,
      table.stage,
    ),
  ],
);

export const coordinationInstitutionsV2 = pgTable(
  "coordination_institutions_v2",
  {
    id: text("id").primaryKey(),
    officialNameArabic: text("official_name_arabic").notNull(),
    normalizedName: text("normalized_name").notNull(),
    institutionClass: coordinationInstitutionClassEnum("institution_class").notNull(),
    governorate: text("governorate"),
    validFromYear: integer("valid_from_year").notNull().default(2021),
    validToYear: integer("valid_to_year"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("coordination_institutions_v2_class_idx").on(table.institutionClass),
    index("coordination_institutions_v2_name_idx").on(table.normalizedName),
  ],
);

export const coordinationPhysicalFacultiesV2 = pgTable(
  "coordination_physical_faculties_v2",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => coordinationInstitutionsV2.id),
    canonicalNameArabic: text("canonical_name_arabic").notNull(),
    normalizedName: text("normalized_name").notNull(),
    sector: text("sector").notNull(),
    campus: text("campus"),
    governorate: text("governorate"),
    institutionClass: coordinationInstitutionClassEnum("institution_class").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("coordination_physical_faculties_v2_institution_idx").on(table.institutionId),
    index("coordination_physical_faculties_v2_sector_idx").on(table.sector),
  ],
);

export const coordinationAdmissionOptionsV2 = pgTable(
  "coordination_admission_options_v2",
  {
    id: text("id").primaryKey(),
    physicalFacultyId: text("physical_faculty_id")
      .notNull()
      .references(() => coordinationPhysicalFacultiesV2.id),
    canonicalNameArabic: text("canonical_name_arabic").notNull(),
    normalizedName: text("normalized_name").notNull(),
    branch: branchEnum("branch").notNull(),
    affiliation: text("affiliation").notNull().default("regular"),
    requiresAptitudeTest: boolean("requires_aptitude_test").notNull().default(false),
    sector: text("sector").notNull(),
    governorate: text("governorate"),
    institutionClass: coordinationInstitutionClassEnum("institution_class").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("coordination_admission_options_v2_faculty_idx").on(table.physicalFacultyId),
    index("coordination_admission_options_v2_branch_sector_idx").on(
      table.branch,
      table.sector,
    ),
  ],
);

export const coordinationAliasesV2 = pgTable(
  "coordination_aliases_v2",
  {
    id: text("id").primaryKey(),
    admissionOptionId: text("admission_option_id").references(
      () => coordinationAdmissionOptionsV2.id,
      { onDelete: "set null" },
    ),
    officialLabel: text("official_label").notNull(),
    normalizedLabel: text("normalized_label").notNull(),
    canonicalLabel: text("canonical_label").notNull(),
    branch: branchEnum("branch").notNull(),
    validFromYear: integer("valid_from_year").notNull(),
    validToYear: integer("valid_to_year").notNull(),
    status: aliasResolutionStatusEnum("status").notNull(),
    rule: text("rule").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coordination_aliases_v2_context_idx").on(
      table.normalizedLabel,
      table.branch,
      table.validFromYear,
      table.validToYear,
    ),
    index("coordination_aliases_v2_status_idx").on(table.status),
  ],
);

export const coordinationHistoricalObservationsV2 = pgTable(
  "coordination_historical_observations_v2",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    admissionOptionId: text("admission_option_id").references(
      () => coordinationAdmissionOptionsV2.id,
      { onDelete: "set null" },
    ),
    officialNameArabic: text("official_name_arabic").notNull(),
    normalizedOfficialName: text("normalized_official_name").notNull(),
    minimumScore: doublePrecision("minimum_score").notNull(),
    maximumScore: doublePrecision("maximum_score").notNull(),
    minimumPercentage: doublePrecision("minimum_percentage").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceHash: text("source_hash").notNull(),
    institutionClass: coordinationInstitutionClassEnum("institution_class").notNull(),
    resolutionStatus: aliasResolutionStatusEnum("resolution_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("coordination_historical_observations_v2_option_year_idx").on(
      table.admissionOptionId,
      table.year,
    ),
    index("coordination_historical_observations_v2_branch_year_idx").on(
      table.branch,
      table.year,
    ),
    index("coordination_historical_observations_v2_resolution_idx").on(table.resolutionStatus),
  ],
);

export const coordinationAvailabilityV2 = pgTable(
  "coordination_availability_v2",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    stage: integer("stage").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    branch: branchEnum("branch").notNull(),
    admissionOptionId: text("admission_option_id").references(
      () => coordinationAdmissionOptionsV2.id,
      { onDelete: "set null" },
    ),
    officialNameArabic: text("official_name_arabic").notNull(),
    normalizedOfficialName: text("normalized_official_name").notNull(),
    institutionClass: coordinationInstitutionClassEnum("institution_class").notNull(),
    availabilityState: coordinationAvailabilityStateEnum("availability_state").notNull(),
    requiresAptitudeTest: boolean("requires_aptitude_test").notNull().default(false),
    sourceKey: text("source_key").notNull(),
    sourceTier: sourceTierEnum("source_tier").notNull(),
    resolutionStatus: aliasResolutionStatusEnum("resolution_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coordination_availability_v2_context_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
      table.normalizedOfficialName,
    ),
    index("coordination_availability_v2_lookup_idx").on(
      table.year,
      table.stage,
      table.educationSystem,
      table.branch,
      table.availabilityState,
    ),
  ],
);

export const modelEvaluationRunsV2 = pgTable(
  "model_evaluation_runs_v2",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelVersion: text("model_version").notNull(),
    dataHash: text("data_hash").notNull(),
    metricsJson: jsonb("metrics_json").$type<Record<string, unknown>>().notNull(),
    gatesJson: jsonb("gates_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("model_evaluation_runs_v2_model_hash_idx").on(
      table.modelVersion,
      table.dataHash,
    ),
  ],
);

export const savedStudents = pgTable(
  "saved_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    seatNumber: text("seat_number").notNull(),
    studentNameSnapshot: text("student_name_snapshot").notNull(),
    educationSystem: educationSystemEnum("education_system").notNull(),
    scoreSnapshot: doublePrecision("score_snapshot").notNull(),
    maxScoreSnapshot: doublePrecision("max_score_snapshot").notNull(),
    percentageSnapshot: doublePrecision("percentage_snapshot").notNull(),
    branch: branchEnum("branch").notNull(),
    branchSource: branchSourceEnum("branch_source").notNull(),
    resultStatusSnapshot: text("result_status_snapshot"),
    resultSnapshotJson: jsonb("result_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_students_user_year_seat_idx").on(
      table.userId,
      table.year,
      table.seatNumber,
    ),
    index("saved_students_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const predictionRuns = pgTable(
  "prediction_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    savedStudentId: uuid("saved_student_id")
      .references(() => savedStudents.id, { onDelete: "set null" }),
    year: integer("year").notNull(),
    seatNumber: text("seat_number").notNull(),
    coordinationStage: integer("coordination_stage").notNull(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id),
    modelMode: predictionModeEnum("model_mode").notNull(),
    score: doublePrecision("score").notNull(),
    percentage: doublePrecision("percentage").notNull(),
    branch: branchEnum("branch").notNull(),
    governorate: text("governorate"),
    inputHash: text("input_hash").notNull(),
    freeRecommendationCountSnapshot: integer(
      "free_recommendation_count_snapshot",
    )
      .notNull()
      .default(1),
    resultSnapshotJson: jsonb("result_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("prediction_runs_dedup_idx").on(
      table.userId,
      table.savedStudentId,
      table.modelVersionId,
      table.inputHash,
    ),
    index("prediction_runs_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("prediction_runs_student_created_idx").on(
      table.savedStudentId,
      table.createdAt,
    ),
    index("prediction_runs_seat_created_idx").on(
      table.year,
      table.seatNumber,
      table.createdAt,
    ),
    index("prediction_runs_seat_model_input_idx").on(
      table.year,
      table.seatNumber,
      table.modelVersionId,
      table.inputHash,
    ),
    index("prediction_runs_stage_model_idx").on(
      table.year,
      table.coordinationStage,
      table.modelVersionId,
    ),
  ],
);

export const predictionShadowRuns = pgTable(
  "prediction_shadow_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productionPredictionRunId: uuid("production_prediction_run_id").references(
      () => predictionRuns.id,
      { onDelete: "set null" },
    ),
    modelVersionId: uuid("model_version_id").references(() => modelVersions.id, {
      onDelete: "set null",
    }),
    modelVersion: text("model_version").notNull(),
    inputHash: text("input_hash").notNull(),
    resultSnapshotJson: jsonb("result_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    diagnosticsJson: jsonb("diagnostics_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("prediction_shadow_runs_dedup_idx").on(
      table.productionPredictionRunId,
      table.modelVersion,
      table.inputHash,
    ),
    index("prediction_shadow_runs_model_created_idx").on(
      table.modelVersion,
      table.createdAt,
    ),
  ],
);

export const paymentSettings = pgTable("payment_settings", {
  id: integer("id").primaryKey().default(1),
  fullReportPriceEgp: numeric("full_report_price_egp", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("99.00"),
  singleReportPriceEgp: numeric("single_report_price_egp", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("35.00"),
  singleReportOriginalPriceEgp: numeric("single_report_original_price_egp", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("50.00"),
  friends3PriceEgp: numeric("friends_3_price_egp", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("69.00"),
  friends3Enabled: boolean("friends_3_enabled").notNull().default(true),
  autoAcceptPayments: boolean("auto_accept_payments").notNull().default(false),
  offerEnabled: boolean("offer_enabled").notNull().default(true),
  offerTargetProduct: paymentProductTypeEnum("offer_target_product"),
  offerBadgeText: text("offer_badge_text").notNull().default("عرض لفترة محدودة"),
  offerTitle: text("offer_title").notNull().default("عرض التقرير الفردي"),
  offerSubtitle: text("offer_subtitle").notNull().default("افتح تقريرك الكامل بسعر خاص"),
  offerCtaText: text("offer_cta_text").notNull().default("استفد من العرض"),
  offerEndAt: timestamp("offer_end_at", { withTimezone: true }),
  offerShowCountdown: boolean("offer_show_countdown").notNull().default(true),
  offerShowInHeader: boolean("offer_show_in_header").notNull().default(true),
  offerShowInPricingCard: boolean("offer_show_in_pricing_card").notNull().default(true),
  offerShowInLockedOffer: boolean("offer_show_in_locked_offer").notNull().default(true),
  vodafoneCashNumber: text("vodafone_cash_number")
    .notNull()
    .default("01001014231"),
  vodafoneDeepLink: text("vodafone_deep_link")
    .notNull()
    .default("http://vf.eg/vfcash?id=mt&qrId=hpSxBH"),
  vodafoneEnabled: boolean("vodafone_enabled").notNull().default(true),
  orangeCashNumber: text("orange_cash_number")
    .notNull()
    .default("01276101944"),
  orangeEnabled: boolean("orange_enabled").notNull().default(true),
  instapayIdentifier: text("instapay_identifier")
    .notNull()
    .default("01276101944"),
  instapayEnabled: boolean("instapay_enabled").notNull().default(true),
  paymentInstructions: text("payment_instructions")
    .notNull()
    .default("حوّل المبلغ ثم ارفع صورة واضحة لإيصال التحويل."),
  supportContact: text("support_contact")
    .notNull()
    .default("+201276101944"),
  freeRecommendationCount: integer("free_recommendation_count")
    .notNull()
    .default(1),
  homepageStageMessage: text("homepage_stage_message")
    .notNull()
    .default("توقعات تنسيق المرحلة الثانية 2026 — محدثة بعد ظهور نتيجة المرحلة الأولى رسميًا"),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const paymentSubmissions = pgTable(
  "payment_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    savedStudentId: uuid("saved_student_id")
      .references(() => savedStudents.id, { onDelete: "set null" }),
    predictionId: uuid("prediction_id")
      .notNull()
      .references(() => predictionRuns.id),
    year: integer("year").notNull(),
    seatNumber: text("seat_number").notNull(),
    productType: paymentProductTypeEnum("product_type")
      .notNull()
      .default("single"),
    method: paymentMethodEnum("method").notNull(),
    expectedAmount: numeric("expected_amount", { precision: 10, scale: 2 })
      .notNull(),
    currency: text("currency").notNull().default("EGP"),
    priceSnapshotJson: jsonb("price_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    senderIdentifier: text("sender_identifier").notNull(),
    transactionReference: text("transaction_reference"),
    receiptBlobKey: text("receipt_blob_key"),
    receiptSha256: text("receipt_sha256"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
  },
  (table) => [
    uniqueIndex("payment_submissions_receipt_hash_idx").on(table.receiptSha256),
    uniqueIndex("payment_submissions_idempotency_idx").on(
      table.userId,
      table.clientIdempotencyKey,
    ),
    uniqueIndex("payment_submissions_guest_idempotency_idx").on(
      table.year,
      table.seatNumber,
      table.clientIdempotencyKey,
    ),
    index("payment_submissions_status_submitted_idx").on(
      table.status,
      table.submittedAt,
    ),
    index("payment_submissions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("payment_submissions_student_created_idx").on(
      table.savedStudentId,
      table.createdAt,
    ),
    index("payment_submissions_seat_status_idx").on(
      table.year,
      table.seatNumber,
      table.status,
      table.createdAt,
    ),
  ],
);

export const paymentSubmissionSeats = pgTable(
  "payment_submission_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => paymentSubmissions.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    seatNumber: text("seat_number").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_submission_seats_payment_year_seat_idx").on(
      table.paymentId,
      table.year,
      table.seatNumber,
    ),
    uniqueIndex("payment_submission_seats_payment_position_idx").on(
      table.paymentId,
      table.position,
    ),
    index("payment_submission_seats_year_seat_idx").on(
      table.year,
      table.seatNumber,
    ),
  ],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    savedStudentId: uuid("saved_student_id")
      .references(() => savedStudents.id, { onDelete: "set null" }),
    predictionId: uuid("prediction_id").references(() => predictionRuns.id),
    paymentId: uuid("payment_id").references(() => paymentSubmissions.id),
    eventType: ledgerEventTypeEnum("event_type").notNull(),
    units: integer("units").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("credit_ledger_idempotency_idx").on(table.idempotencyKey),
    uniqueIndex("credit_ledger_payment_event_idx").on(
      table.paymentId,
      table.eventType,
    ),
    index("credit_ledger_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const predictionEntitlements = pgTable(
  "prediction_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    savedStudentId: uuid("saved_student_id")
      .notNull()
      .references(() => savedStudents.id),
    year: integer("year").notNull(),
    originPredictionId: uuid("origin_prediction_id")
      .notNull()
      .references(() => predictionRuns.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => paymentSubmissions.id),
    scope: text("scope").notNull().default("year_all_stages"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("prediction_entitlements_student_year_idx").on(
      table.userId,
      table.savedStudentId,
      table.year,
    ),
    uniqueIndex("prediction_entitlements_payment_idx").on(table.paymentId),
  ],
);

export const adminManualEntitlementGrants = pgTable(
  "admin_manual_entitlement_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    seatNumber: text("seat_number").notNull(),
    studentNameSnapshot: text("student_name_snapshot"),
    recordRevenue: boolean("record_revenue").notNull().default(false),
    amount: numeric("amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("EGP"),
    method: paymentMethodEnum("method"),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_manual_grants_year_seat_idx").on(
      table.year,
      table.seatNumber,
    ),
    index("admin_manual_grants_revenue_created_idx").on(
      table.recordRevenue,
      table.createdAt,
    ),
  ],
);

export const seatEntitlements = pgTable(
  "seat_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    seatNumber: text("seat_number").notNull(),
    originPredictionId: uuid("origin_prediction_id").references(
      () => predictionRuns.id,
      { onDelete: "set null" },
    ),
    paymentId: uuid("payment_id").references(() => paymentSubmissions.id),
    manualGrantId: uuid("manual_grant_id").references(
      () => adminManualEntitlementGrants.id,
    ),
    scope: text("scope").notNull().default("year_all_stages"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("seat_entitlements_year_seat_idx").on(
      table.year,
      table.seatNumber,
    ),
    index("seat_entitlements_payment_idx").on(table.paymentId),
    uniqueIndex("seat_entitlements_manual_grant_idx").on(table.manualGrantId),
    index("seat_entitlements_seat_idx").on(table.seatNumber),
  ],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    beforeJson: jsonb("before_json").$type<Record<string, unknown>>(),
    afterJson: jsonb("after_json").$type<Record<string, unknown>>(),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_audit_logs_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("admin_audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
    ),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    count: integer("count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ name: "rate_limits_pk", columns: [table.scope, table.key] }),
    index("rate_limits_expires_idx").on(table.expiresAt),
  ],
);

import type { Branch, EducationSystem } from "@/lib/grade-scales";
import type { ProximityTier } from "@/lib/governorates";

export type PublicInstitutionClass =
  | "public_university"
  | "public_technological_university";

export type InstitutionClass =
  | PublicInstitutionClass
  | "public_institute"
  | "private_or_higher_institute"
  | "unknown";

export type AliasResolutionStatus = "resolved" | "ambiguous" | "rejected";
export type FitSignal = "green" | "yellow" | "orange" | "red";
export type InternalConfidence = "high" | "medium" | "low";

export type CoordinationSourceV2 = {
  key: string;
  tier: "A" | "B" | "C";
  publisher: string;
  url: string;
  retrievedAt: string;
  sha256: string;
  rowCount: number;
  officialArtifact: boolean;
};

export type CanonicalInstitutionV2 = {
  id: string;
  officialNameArabic: string;
  normalizedName: string;
  institutionClass: PublicInstitutionClass;
  governorate: string | null;
};

export type PhysicalFacultyV2 = {
  id: string;
  institutionId: string;
  canonicalNameArabic: string;
  normalizedName: string;
  sector: string;
  campus: string | null;
  governorate: string | null;
  institutionClass: PublicInstitutionClass;
};

export type AdmissionOptionV2 = {
  id: string;
  physicalFacultyId: string;
  institutionId: string;
  canonicalNameArabic: string;
  normalizedName: string;
  branch: Branch;
  affiliation: "regular" | "directed_affiliation";
  requiresAptitudeTest: boolean;
  sector: string;
  governorate: string | null;
  institutionClass: PublicInstitutionClass;
};

export type AliasRecordV2 = {
  id: string;
  officialLabel: string;
  normalizedLabel: string;
  canonicalLabel: string;
  admissionOptionId: string | null;
  branch: Branch;
  validFromYear: number;
  validToYear: number;
  status: AliasResolutionStatus;
  rule: "exact" | "explicit_rename" | "year_variant" | "ambiguous";
  notes: string | null;
};

export type HistoricalObservationV2 = {
  id: string;
  year: number;
  educationSystem: EducationSystem;
  branch: Branch;
  admissionOptionId: string | null;
  officialNameArabic: string;
  minimumScore: number;
  maximumScore: number;
  minimumPercentage: number;
  sourceKey: string;
  institutionClass: InstitutionClass;
  resolutionStatus: AliasResolutionStatus;
};

export type StageVacancyV2 = {
  id: string;
  year: 2026;
  stage: 2;
  educationSystem: "new";
  branch: Branch;
  admissionOptionId: string | null;
  officialNameArabic: string;
  normalizedOfficialName: string;
  institutionClass: InstitutionClass;
  requiresAptitudeTest: boolean;
  sourceKey: string;
  sourceTier: "A" | "B" | "C";
  resolutionStatus: AliasResolutionStatus;
};

export type OfficialCutoffV2 = {
  id: string;
  year: 2026;
  stage: 1;
  educationSystem: "new";
  branch: Branch;
  admissionOptionId: string | null;
  officialNameArabic: string;
  minimumScore: number;
  maximumScore: number;
  minimumPercentage: number;
  sourceKey: string;
  resolutionStatus: AliasResolutionStatus;
};

export type PredictionV2Seed = {
  schemaVersion: "prediction-v2-data@1";
  generatedAt: string;
  dataHash: string;
  model: {
    version: "stage2-2026-v2-shadow";
    mode: "normalized_percentage";
    shadow: true;
    activated: false;
    recentWeights: { "2025": number; "2024": number; "robust2021To2023": number };
    sparseShrinkagePrior: number;
    calibrationMinimumSample: number;
    calibrationShrinkagePrior: number;
    calibrationEligibleCells: string[];
    calibrationTransferGate: "blocked_missing_stage_level_holdouts" | "passed";
    minimumIntervalHalfWidth: number;
    closestDisplayCap: number;
    ambitiousDisplayCap: number;
    stage3DisplayCap: number;
    redDisplayCap: number;
    relevanceBucketWidth: number;
  };
  stageRules: Array<{
    stage: 2;
    educationSystem: EducationSystem;
    branch: Branch;
    minimumScore: number;
    maximumScore: number;
    minimumPercentage: number;
    studentCount: number | null;
  }>;
  sources: CoordinationSourceV2[];
  institutions: CanonicalInstitutionV2[];
  physicalFaculties: PhysicalFacultyV2[];
  admissionOptions: AdmissionOptionV2[];
  aliases: AliasRecordV2[];
  historicalObservations: HistoricalObservationV2[];
  stageVacancies: StageVacancyV2[];
  officialCutoffs: OfficialCutoffV2[];
  separateInstitutes: Array<{
    officialNameArabic: string;
    normalizedOfficialName: string;
    branch: Branch;
    institutionClass: "public_institute";
    sourceKey: string;
  }>;
  excludedStage2Rows: Array<{
    officialNameArabic: string;
    normalizedOfficialName: string;
    sourceKey: string;
    institutionClass: "private_or_higher_institute" | "unknown";
    reason: "out_of_scope_private_or_higher" | "unclassified_fail_closed";
  }>;
  diagnostics: {
    rawStage2Rows: Record<"scientific" | "literary", number>;
    publicSourceRows: number;
    publicTechnologicalRows: number;
    publicInstituteRows: number;
    privateOrHigherInstituteRows: number;
    unknownRows: number;
    resolvedPublicVacancies: number;
    unresolvedPublicVacancies: number;
    ambiguousAliases: number;
    historicalRawRows: number;
    historicalResolvedObservations: number;
    activationBlockers: string[];
  };
};

export type PredictionV2Recommendation = {
  id: string;
  admissionOptionId: string;
  officialNameArabic: string;
  branch: Branch;
  availability: "listed_stage_2";
  institutionClass: PublicInstitutionClass;
  predictedCutoffPercentage: number;
  expectedRange: [number, number];
  intervalHalfWidth: number;
  fit: FitSignal;
  fitLabel: "مناسب جدًا" | "فرصة جيدة" | "اختيار طموح" | "بعيد عن مجموعك";
  internalConfidence: InternalConfidence;
  limitedDataWarning: string | null;
  difference: number;
  history: Partial<Record<2021 | 2022 | 2023 | 2024 | 2025, number>>;
  requiresAptitudeTest: boolean;
  governorate: string | null;
  proximityTier: ProximityTier;
  proximityLabel: string;
    modelReasons: string[];
};

export type Stage3ForecastV2 = {
  id: string;
  admissionOptionId: string;
  officialNameArabic: string;
  branch: Branch;
  availability: "forecast_stage_3";
  availabilityLabel: "متوقع يظهر في المرحلة الثالثة";
  predictedCutoffPercentage: number;
  expectedRange: [number, number];
  fit: FitSignal;
  fitLabel: "مناسب جدًا" | "فرصة جيدة" | "اختيار طموح" | "بعيد عن مجموعك";
  difference: number;
  internalConfidence: InternalConfidence;
  limitedDataWarning: string | null;
  requiresAptitudeTest: boolean;
  governorate: string | null;
  proximityTier: ProximityTier;
  proximityLabel: string;
  basis: "current_stage_2_vacancy" | "historical_public_option";
};

export type PredictionV2Report = {
  schemaVersion: "prediction-v2-report@1";
  year: 2026;
  coordinationStage: 2;
  modelVersion: "stage2-2026-v2-shadow";
  shadow: true;
  modelMode: "normalized_percentage";
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  governorate: string | null;
  eligibility: {
    eligible: boolean;
    status: "eligible_stage_2" | "below_stage_2_floor" | "availability_unknown";
    minimumScore: number;
    minimumPercentage: number;
    message: string;
  };
  groups: {
    closest: { items: PredictionV2Recommendation[]; hiddenCount: number };
    ambitious: { items: PredictionV2Recommendation[]; hiddenCount: number };
    stage3Forecast: { items: Stage3ForecastV2[]; hiddenCount: number };
    higherThanScore: {
      items: PredictionV2Recommendation[];
      hiddenCount: number;
      collapsed: true;
    };
  };
  recommendations: PredictionV2Recommendation[];
  officialClosedFacts: OfficialCutoffV2[];
  coverageWarning: {
    active: boolean;
    code: string;
    message: string;
    reasons: string[];
  };
  diagnostics: {
    candidateVacancies: number;
    resolvedCandidates: number;
    unresolvedCandidates: number;
    modeledCandidates: number;
    unmodeledCandidates: number;
    aptitudeExcludedCandidates: number;
    realisticOptions: number;
    fitCounts: Record<FitSignal, number>;
    sourceOfficialArtifact: boolean;
  };
  disclaimer: string;
};

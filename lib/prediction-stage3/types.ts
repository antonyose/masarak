import type { Branch, EducationSystem } from "@/lib/grade-scales";
import type {
  AliasRecordV2,
  FitSignal,
  InstitutionClass,
  InternalConfidence,
  PublicInstitutionClass,
} from "@/lib/prediction-v2/types";
import type { ProximityTier } from "@/lib/governorates";

export type Stage3Source = {
  key: string;
  publisher: string;
  url: string;
  retrievedAt: string;
  sha256: string;
  rowCount: number;
  officialArtifact: boolean;
};

export type Stage2ActualCutoff = {
  id: string;
  year: 2026;
  stage: 2;
  educationSystem: EducationSystem;
  branch: Branch;
  admissionOptionId: string | null;
  officialNameArabic: string;
  minimumScore: number;
  maximumScore: number;
  minimumPercentage: number;
  institutionClass: InstitutionClass;
  resolutionStatus: "resolved" | "ambiguous" | "rejected";
  sourceKey: string;
};

export type Stage3OfficialVacancy = {
  id: string;
  year: 2026;
  stage: 3;
  educationSystem: "new";
  branch: Branch;
  admissionOptionId: string;
  officialNameArabic: string;
  institutionClass: PublicInstitutionClass;
  requiresAptitudeTest: boolean;
  requiresGenderCheck: boolean;
  sourceKey: string;
};

export type Stage3Seed = {
  schemaVersion: "stage3-2026-data@1";
  generatedAt: string;
  dataHash: string;
  model: {
    version: "stage3-2026-v1";
    stage: 3;
    mode: "normalized_percentage";
    calibrationCap: number;
    calibrationPrior: number;
    minimumIntervalHalfWidth: number;
    closestDisplayCap: number;
    ambitiousDisplayCap: number;
    redDisplayCap: number;
    conditionalDisplayCap: number;
    relevanceBucketWidth: number;
  };
  stageRules: Array<{
    educationSystem: EducationSystem;
    branch: Branch;
    minimumScore: number;
    maximumScore: number;
    minimumPercentage: number;
    officialVacancyArtifactAvailable: boolean;
  }>;
  sources: Stage3Source[];
  stage2ActualCutoffs: Stage2ActualCutoff[];
  stage3Vacancies: Stage3OfficialVacancy[];
  aliases: AliasRecordV2[];
  calibrationCells: Record<string, { sampleSize: number; adjustment: number; residualP80: number }>;
  evaluation: {
    sampleSize: number;
    baseline: Record<string, unknown>;
    calibratedLeaveOneOut: Record<string, unknown>;
  };
  diagnostics: {
    rawVacancyRows: { scientific: number; literary: number };
    publicUniversityRows: { scientific: number; literary: number };
    publicTechnologicalRows: { scientific: number; literary: number };
    publicInstituteRows: { scientific: number; literary: number };
    privateOrHigherInstituteRows: { scientific: number; literary: number };
    unknownRows: { scientific: number; literary: number };
    resolvedOptionsByBranch: Record<Branch, number>;
    duplicateVariantsByBranch: Record<Branch, number>;
    unresolvedPublicRows: number;
    ambiguousPublicRows: number;
    oldSystemVacancyArtifactAvailable: false;
  };
};

export type Stage3Recommendation = {
  id: string;
  admissionOptionId: string;
  officialNameArabic: string;
  branch: Branch;
  availability: "listed_stage_3";
  availabilityLabel: "متاح في المرحلة الثالثة";
  institutionClass: PublicInstitutionClass;
  predictedCutoffPercentage: number;
  expectedRange: [number, number];
  intervalHalfWidth: number;
  fit: FitSignal;
  fitLabel: "مناسب جدًا" | "فرصة جيدة" | "اختيار طموح" | "بعيد عن مجموعك";
  internalConfidence: InternalConfidence;
  difference: number;
  history: Partial<Record<2021 | 2022 | 2023 | 2024 | 2025, number>>;
  requiresAptitudeTest: boolean;
  requiresGenderCheck: boolean;
  eligibilityCondition: string | null;
  governorate: string | null;
  proximityTier: ProximityTier;
  proximityLabel: string;
  modelReasons: string[];
};

export type Stage3Report = {
  schemaVersion: "stage3-report@1";
  coordinationStage: 3;
  modelVersion: "stage3-2026-v1";
  modelMode: "normalized_percentage";
  dataHash: string;
  score: number;
  maxScore: number;
  percentage: number;
  educationSystem: EducationSystem;
  branch: Branch;
  governorate: string | null;
  availabilityStatus: "official" | "official_list_unavailable_for_old_system";
  availabilityLabel: string;
  registration: {
    minimumScore: number;
    minimumPercentage: number;
    eligible: boolean;
  };
  groups: {
    closest: { items: Stage3Recommendation[]; hiddenCount: number };
    ambitious: { items: Stage3Recommendation[]; hiddenCount: number };
    higherThanScore: { items: Stage3Recommendation[]; hiddenCount: number; collapsed: true };
    conditional: { items: Stage3Recommendation[]; hiddenCount: number };
  };
  recommendations: Stage3Recommendation[];
  conditionalRecommendations: Stage3Recommendation[];
  totalRecommendationCount: number;
  lockedRecommendationCount: number;
  premium: boolean;
  disclaimers: string[];
  diagnostics: {
    officialVacancies: number;
    modeledCandidates: number;
    conditionalCandidates: number;
    fitCounts: Record<FitSignal, number>;
  };
};

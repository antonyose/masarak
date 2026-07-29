export const gradeScales = {
  2023: { old: 410 },
  2024: { old: 410 },
  2025: { new: 320, old: 410 },
  2026: { new: 320 },
} as const;

export type EducationSystem = "new" | "old";
export type Branch = "science" | "mathematics" | "literary";
export type SupportedYear = keyof typeof gradeScales;

export function getMaxScore(
  year: number,
  system: EducationSystem,
): number | null {
  const yearConfig = gradeScales[year as SupportedYear] as
    | Partial<Record<EducationSystem, number>>
    | undefined;
  return yearConfig?.[system] ?? null;
}

export function scoreToPercentage(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    throw new Error("Score and maximum score must be finite positive values.");
  }
  return (score / maxScore) * 100;
}

export function percentageToScore(
  percentage: number,
  maxScore: number,
): number {
  if (
    !Number.isFinite(percentage) ||
    !Number.isFinite(maxScore) ||
    percentage < 0 ||
    percentage > 100 ||
    maxScore <= 0
  ) {
    throw new Error("Percentage must be between 0 and 100.");
  }
  return (percentage / 100) * maxScore;
}

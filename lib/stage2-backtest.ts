import stage2Seed from "@/lib/coordination-data/stage2-2026.json";
import historical from "@/lib/coordination-data/historical-cutoffs-2023-2025.json";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function metrics(residuals: Array<{ branch: string; error: number }>) {
  const absolute = residuals.map((row) => Math.abs(row.error));
  const byBranch = Object.fromEntries(
    ["science", "mathematics", "literary"].map((branch) => {
      const values = residuals
        .filter((row) => row.branch === branch)
        .map((row) => Math.abs(row.error));
      return [
        branch,
        {
          sampleSize: values.length,
          mae: values.length
            ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
            : null,
        },
      ];
    }),
  );
  return {
    sampleSize: residuals.length,
    mae: absolute.length
      ? Number((absolute.reduce((sum, value) => sum + value, 0) / absolute.length).toFixed(4))
      : null,
    medianAbsoluteError: Number(median(absolute).toFixed(4)),
    coverageWithinTwoPoints: absolute.length
      ? Number((absolute.filter((value) => value <= 2).length / absolute.length).toFixed(4))
      : null,
    byBranch,
  };
}

export function runStage2Backtests() {
  const rows = historical.rows;
  const grouped = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const key = `${row.branch}:${row.facultyKey}`;
    const years = grouped.get(key) ?? new Map<number, number>();
    if (!years.has(row.year)) years.set(row.year, row.minimumPercentage);
    grouped.set(key, years);
  }

  const holdout2025: Array<{ branch: string; error: number }> = [];
  for (const [key, years] of grouped) {
    const actual = years.get(2025);
    if (actual == null || !years.has(2024) || !years.has(2023)) continue;
    const predicted = years.get(2024)! * 0.6 + years.get(2023)! * 0.4;
    holdout2025.push({ branch: key.split(":", 1)[0], error: actual - predicted });
  }

  const stage1_2026: Array<{ branch: string; error: number }> = [];
  for (const actual of stage2Seed.officialCutoffs) {
    const years = grouped.get(`${actual.branch}:${actual.facultyKey}`);
    if (!years) continue;
    const available = [2025, 2024, 2023]
      .map((year) => ({ year, value: years.get(year) }))
      .filter((row): row is { year: number; value: number } => row.value != null);
    if (!available.length) continue;
    const weights: Record<number, number> = { 2025: 0.5, 2024: 0.3, 2023: 0.2 };
    const totalWeight = available.reduce((sum, row) => sum + weights[row.year], 0);
    const predicted = available.reduce(
      (sum, row) => sum + row.value * weights[row.year],
      0,
    ) / totalWeight;
    stage1_2026.push({ branch: actual.branch, error: actual.percentage - predicted });
  }

  const result = {
    holdout2025: metrics(holdout2025),
    stage1_2026: metrics(stage1_2026),
  };
  return {
    ...result,
    activationReady:
      result.holdout2025.sampleSize >= 20 &&
      result.stage1_2026.sampleSize >= 20 &&
      (result.holdout2025.mae ?? Infinity) <= 5 &&
      (result.stage1_2026.mae ?? Infinity) <= 5,
    activationScope: "2026:new-system:stage-2",
    oldSystemGateApplied: false,
  };
}

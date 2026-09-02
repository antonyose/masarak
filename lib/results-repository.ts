import "server-only";

import { and, count, eq, ilike, inArray, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { studentResults, updatedStudentResults } from "@/db/schema";
import { normalizeArabicName, normalizeDigits } from "@/lib/normalize-arabic";
import { findTursoResultBySeat, searchTursoResults, type TursoStudentResult } from "@/lib/turso";

function mapPostgres(row: typeof studentResults.$inferSelect): TursoStudentResult {
  const branch = row.branch;
  return {
    year: row.year,
    seatNumber: row.seatNumber,
    studentName: row.studentNameOriginal,
    educationSystem: row.educationSystem,
    branch,
    branchLabel: branch === "science" ? "علمي علوم" : branch === "mathematics" ? "علمي رياضة" : branch === "literary" ? "أدبي" : "غير متاح",
    totalScore: row.totalScore,
    maxScore: row.maxScore,
    percentage: row.percentage,
    nationalRank: null,
    nationalTotalStudents: null,
    resultStatus: row.resultStatus ?? "غير متاح",
    schoolName: row.schoolName,
    governorate: row.governorate,
  };
}

export async function getUpdatedStudentResult(year: number, seatNumber: string) {
  if (!process.env.DATABASE_URL) return null;
  try {
    const [override] = await getDatabase()
      .select()
      .from(updatedStudentResults)
      .where(
        and(
          eq(updatedStudentResults.year, year),
          eq(updatedStudentResults.seatNumber, normalizeDigits(seatNumber)),
        ),
      )
      .limit(1);
    return override ?? null;
  } catch (err) {
    console.error("Failed to fetch updated student result:", err);
    return null;
  }
}

export async function getUpdatedStudentResultsMap(year: number, seatNumbers: string[]) {
  if (!seatNumbers.length || !process.env.DATABASE_URL) {
    return new Map<string, typeof updatedStudentResults.$inferSelect>();
  }
  try {
    const normalized = seatNumbers.map(normalizeDigits);
    const overrides = await getDatabase()
      .select()
      .from(updatedStudentResults)
      .where(
        and(
          eq(updatedStudentResults.year, year),
          inArray(updatedStudentResults.seatNumber, normalized),
        ),
      );
    return new Map(overrides.map((row) => [row.seatNumber, row]));
  } catch (err) {
    console.error("Failed to batch fetch updated student results:", err);
    return new Map<string, typeof updatedStudentResults.$inferSelect>();
  }
}

export function enrichWithUpdatedResult(
  result: TursoStudentResult,
  override: typeof updatedStudentResults.$inferSelect | null | undefined,
): TursoStudentResult {
  if (override) {
    return {
      ...result,
      totalScore: override.updatedTotalScore,
      percentage: override.updatedPercentage,
      maxScore: override.maxScore ?? result.maxScore,
      isUpdatedResult: true,
      originalTotalScore: override.originalTotalScore ?? result.totalScore,
      originalPercentage: override.originalPercentage ?? result.percentage,
      canPromptRound2: false,
    };
  }
  const isEligible = result.percentage != null && result.percentage < 75;
  return {
    ...result,
    isUpdatedResult: false,
    originalTotalScore: result.totalScore,
    originalPercentage: result.percentage,
    canPromptRound2: isEligible,
  };
}

export async function findResultBySeat(year: number, seatNumber: string) {
  const normalizedSeat = normalizeDigits(seatNumber);
  let postgres: typeof studentResults.$inferSelect | null = null;
  let override: typeof updatedStudentResults.$inferSelect | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const [pgRow, overrideRow] = await Promise.all([
        getDatabase()
          .select()
          .from(studentResults)
          .where(and(eq(studentResults.year, year), eq(studentResults.seatNumber, normalizedSeat)))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        getUpdatedStudentResult(year, normalizedSeat),
      ]);
      postgres = pgRow;
      override = overrideRow;
    } catch (err) {
      console.error("Postgres query in findResultBySeat failed:", err);
    }
  }

  let baseResult: TursoStudentResult | null = postgres ? mapPostgres(postgres) : null;
  if (!baseResult) {
    try {
      baseResult = await findTursoResultBySeat(year, normalizedSeat);
    } catch (error) {
      console.error("Turso seat fallback unavailable:", error);
    }
  }

  if (!baseResult) return null;
  return enrichWithUpdatedResult(baseResult, override);
}

export async function searchResults({
  method,
  query,
  year,
  limit = 20,
}: {
  method: "seat" | "name";
  query: string;
  year: number;
  limit?: number;
}) {
  if (method === "seat") {
    const result = await findResultBySeat(year, query);
    return { results: result ? [result] : [], totalCount: result ? 1 : 0 };
  }
  const normalized = normalizeArabicName(query).trim();
  const condition = and(
    eq(studentResults.year, year),
    or(
      ilike(studentResults.studentNameNormalized, `${normalized}%`),
      ilike(studentResults.studentNameNormalized, `% ${normalized}%`),
    ),
  );
  let results: TursoStudentResult[] = [];
  let totalCount = 0;

  if (process.env.DATABASE_URL) {
    try {
      const [postgresRows, totals] = await Promise.all([
        getDatabase().select().from(studentResults).where(condition).orderBy(studentResults.studentNameNormalized).limit(limit),
        getDatabase().select({ value: count() }).from(studentResults).where(condition),
      ]);
      if (postgresRows.length) {
        results = postgresRows.map(mapPostgres);
        totalCount = totals[0]?.value ?? postgresRows.length;
      }
    } catch (err) {
      console.error("Postgres search in searchResults failed:", err);
    }
  }

  if (!results.length) {
    try {
      const tursoRes = await searchTursoResults({ method, query, year, limit });
      results = tursoRes.results;
      totalCount = tursoRes.totalCount;
    } catch (error) {
      console.error("Turso name fallback unavailable:", error);
      return { results: [], totalCount: 0 };
    }
  }

  if (!results.length) return { results: [], totalCount: 0 };
  const overridesMap = await getUpdatedStudentResultsMap(
    year,
    results.map((r) => r.seatNumber),
  );
  return {
    results: results.map((r) => enrichWithUpdatedResult(r, overridesMap.get(r.seatNumber))),
    totalCount,
  };
}


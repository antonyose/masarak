import "server-only";

import { and, count, eq, ilike, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { studentResults } from "@/db/schema";
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

export async function findResultBySeat(year: number, seatNumber: string) {
  const [postgres] = await getDatabase()
    .select()
    .from(studentResults)
    .where(and(eq(studentResults.year, year), eq(studentResults.seatNumber, normalizeDigits(seatNumber))))
    .limit(1);
  if (postgres) return mapPostgres(postgres);
  try {
    return await findTursoResultBySeat(year, seatNumber);
  } catch (error) {
    console.error("Turso seat fallback unavailable:", error);
    return null;
  }
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
  const [postgresRows, totals] = await Promise.all([
    getDatabase().select().from(studentResults).where(condition).orderBy(studentResults.studentNameNormalized).limit(limit),
    getDatabase().select({ value: count() }).from(studentResults).where(condition),
  ]);
  if (postgresRows.length) {
    return { results: postgresRows.map(mapPostgres), totalCount: totals[0]?.value ?? postgresRows.length };
  }
  try {
    return await searchTursoResults({ method, query, year, limit });
  } catch (error) {
    console.error("Turso name fallback unavailable:", error);
    return { results: [], totalCount: 0 };
  }
}

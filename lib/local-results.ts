import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeArabicName, normalizeDigits } from "@/lib/normalize-arabic";

export type SearchableStudentResult = {
  year: number;
  seatNumber: string;
  studentName: string;
  educationSystem: "new" | "old" | "unknown";
  branch: "science" | "mathematics" | "literary" | "unknown";
  branchLabel: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  nationalRank: number | null;
  nationalTotalStudents: number | null;
  resultStatus: string;
  schoolName: string | null;
  governorate: string | null;
};

export type LocalSearchResult = {
  results: SearchableStudentResult[];
  totalCount: number;
};

type LocalDatabaseGlobal = typeof globalThis & {
  __masarakResultsDatabase?: DatabaseSync;
};

function getDatabasePath() {
  return path.resolve(
    process.env.RESULTS_SQLITE_PATH ??
      path.join(process.cwd(), "data", "private", "results-2026-v2.sqlite"),
  );
}

export function hasLocalResultsDatabase() {
  return existsSync(getDatabasePath());
}

function getLocalDatabase() {
  const shared = globalThis as LocalDatabaseGlobal;
  if (!shared.__masarakResultsDatabase) {
    shared.__masarakResultsDatabase = new DatabaseSync(getDatabasePath(), {
      readOnly: true,
    });
  }
  return shared.__masarakResultsDatabase;
}

function mapRow(row: Record<string, unknown>): SearchableStudentResult {
  const branch = String(row.branch ?? "unknown") as SearchableStudentResult["branch"];
  return {
    year: Number(row.year),
    seatNumber: String(row.seatNumber),
    studentName: String(row.studentName),
    educationSystem: String(
      row.educationSystem ?? "unknown",
    ) as SearchableStudentResult["educationSystem"],
    branch,
    branchLabel:
      branch === "science"
        ? "علمي علوم"
        : branch === "mathematics"
          ? "علمي رياضة"
          : branch === "literary"
            ? "أدبي"
            : "غير متاح",
    totalScore: row.totalScore === null ? null : Number(row.totalScore),
    maxScore: row.maxScore === null ? null : Number(row.maxScore),
    percentage: row.percentage === null ? null : Number(row.percentage),
    nationalRank: row.nationalRank === null ? null : Number(row.nationalRank),
    nationalTotalStudents:
      row.nationalTotalStudents === null
        ? null
        : Number(row.nationalTotalStudents),
    resultStatus: String(row.resultStatus ?? "غير متاح"),
    schoolName: row.schoolName === null ? null : String(row.schoolName),
    governorate: row.governorate === null ? null : String(row.governorate),
  };
}

const RESULT_COLUMNS = `
  s.year AS year,
  s.seat_number AS seatNumber,
  s.student_name_original AS studentName,
  s.education_system AS educationSystem,
  s.branch AS branch,
  s.total_score AS totalScore,
  s.max_score AS maxScore,
  s.percentage AS percentage,
  s.national_rank AS nationalRank,
  (
    SELECT metadata.total_students
    FROM result_metadata metadata
    WHERE metadata.year = s.year
  ) AS nationalTotalStudents,
  s.result_status AS resultStatus,
  s.school_name AS schoolName,
  s.governorate AS governorate
`;

export function searchLocalResults({
  method,
  query,
  year,
  limit = 20,
}: {
  method: "seat" | "name";
  query: string;
  year: number;
  limit?: number;
}): LocalSearchResult {
  const database = getLocalDatabase();

  if (method === "seat") {
    const rows = database
      .prepare(
        `SELECT ${RESULT_COLUMNS}
         FROM student_results s
         WHERE s.year = ? AND s.seat_number = ?
         LIMIT 1`,
      )
      .all(year, normalizeDigits(query)) as Record<string, unknown>[];
    return {
      results: rows.map(mapRow),
      totalCount: rows.length,
    };
  }

  const normalized = normalizeArabicName(query).toLowerCase();
  const ftsQuery = `"${normalized.replaceAll('"', '""')}"`;
  const prefixPattern = `${normalized}%`;
  const wordPattern = `% ${normalized}%`;

  const countRow = database
    .prepare(
      `SELECT COUNT(*) AS totalCount
       FROM student_results_fts f
       JOIN student_results s ON s.id = f.rowid
       WHERE s.year = ? AND f.student_name_normalized MATCH ?`,
    )
    .get(year, ftsQuery) as { totalCount?: number | bigint } | undefined;

  const rows = database
    .prepare(
      `SELECT ${RESULT_COLUMNS}
       FROM student_results_fts f
       JOIN student_results s ON s.id = f.rowid
       WHERE s.year = ? AND f.student_name_normalized MATCH ?
       ORDER BY
         CASE
           WHEN s.student_name_normalized = ? THEN 0
           WHEN s.student_name_normalized LIKE ? THEN 1
           WHEN s.student_name_normalized LIKE ? THEN 2
           ELSE 3
         END,
         length(s.student_name_normalized),
         s.id
       LIMIT ?`,
    )
    .all(year, ftsQuery, normalized, prefixPattern, wordPattern, limit) as Record<
    string,
    unknown
  >[];

  return {
    results: rows.map(mapRow),
    totalCount: Number(countRow?.totalCount ?? rows.length),
  };
}

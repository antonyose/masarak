import "server-only";

import { createClient, type Client } from "@libsql/client";
import { normalizeArabicName, normalizeDigits } from "@/lib/normalize-arabic";

export type TursoStudentResult = {
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

let client: Client | null = null;

export function getTursoClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Turso result search is not configured.");
  }
  client = createClient({ url, authToken });
  return client;
}

function branchLabel(branch: TursoStudentResult["branch"]) {
  if (branch === "science") return "علمي علوم";
  if (branch === "mathematics") return "علمي رياضة";
  if (branch === "literary") return "أدبي";
  return "غير متاح";
}

function mapRow(row: Record<string, unknown>): TursoStudentResult {
  const branch = String(row.branch ?? "unknown") as TursoStudentResult["branch"];
  return {
    year: Number(row.year),
    seatNumber: String(row.seatNumber),
    studentName: String(row.studentName),
    educationSystem: String(
      row.educationSystem ?? "unknown",
    ) as TursoStudentResult["educationSystem"],
    branch,
    branchLabel: branchLabel(branch),
    totalScore: row.totalScore == null ? null : Number(row.totalScore),
    maxScore: row.maxScore == null ? null : Number(row.maxScore),
    percentage: row.percentage == null ? null : Number(row.percentage),
    nationalRank: row.nationalRank == null ? null : Number(row.nationalRank),
    nationalTotalStudents:
      row.nationalTotalStudents == null
        ? null
        : Number(row.nationalTotalStudents),
    resultStatus: String(row.resultStatus ?? "غير متاح"),
    schoolName: row.schoolName == null ? null : String(row.schoolName),
    governorate: row.governorate == null ? null : String(row.governorate),
  };
}

const resultColumns = `
  s.year AS year,
  s.seat_number AS seatNumber,
  s.student_name_original AS studentName,
  s.education_system AS educationSystem,
  s.branch AS branch,
  s.total_score AS totalScore,
  s.max_score AS maxScore,
  s.percentage AS percentage,
  s.national_rank AS nationalRank,
  (SELECT total_students FROM result_metadata WHERE year = s.year) AS nationalTotalStudents,
  s.result_status AS resultStatus,
  s.school_name AS schoolName,
  s.governorate AS governorate
`;

export async function findTursoResultBySeat(year: number, seatNumber: string) {
  const result = await getTursoClient().execute({
    sql: `SELECT ${resultColumns}
          FROM student_results s
          WHERE s.year = ? AND s.seat_number = ?
          LIMIT 1`,
    args: [year, normalizeDigits(seatNumber)],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export async function searchTursoResults({
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
    const found = await findTursoResultBySeat(year, query);
    return { results: found ? [found] : [], totalCount: found ? 1 : 0 };
  }

  const normalized = normalizeArabicName(query).toLowerCase();
  const ftsQuery = normalized
    .split(/\s+/u)
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(" AND ");
  const count = await getTursoClient().execute({
    sql: `SELECT COUNT(*) AS totalCount
          FROM student_results_fts f
          JOIN student_results s ON s.id = f.rowid
          WHERE s.year = ? AND f.student_name_normalized MATCH ?`,
    args: [year, ftsQuery],
  });
  const rows = await getTursoClient().execute({
    sql: `SELECT ${resultColumns}
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
    args: [year, ftsQuery, normalized, `${normalized}%`, `% ${normalized}%`, limit],
  });
  return {
    results: rows.rows.map((row) => mapRow(row as Record<string, unknown>)),
    totalCount: Number(count.rows[0]?.totalCount ?? 0),
  };
}

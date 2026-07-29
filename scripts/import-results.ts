import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as XLSX from "xlsx";
import { importSources, studentResults } from "../db/schema";
import { getMaxScore, type EducationSystem } from "../lib/grade-scales";
import { normalizeArabicName, normalizeDigits } from "../lib/normalize-arabic";

type Detection = { index: number; label: string };
type Inspection = {
  workbooks: Array<{
    file: string;
    estimatedYear: number | null;
    sha256: string;
    sheets: Array<{
      name: string;
      headerRow: number;
      detected: Record<string, Detection | undefined>;
      likelyEducationSystems: Array<EducationSystem | "unknown">;
      subjectColumns: Detection[];
    }>;
  }>;
};

const BATCH_SIZE = 1_000;

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(normalizeDigits(String(value ?? "")));
  return Number.isFinite(parsed) ? parsed : null;
}

function branchValue(value: unknown) {
  const normalized = normalizeArabicName(String(value ?? "")).toLowerCase();
  if (/رياض/.test(normalized)) return "mathematics" as const;
  if (/علوم|احياء/.test(normalized)) return "science" as const;
  if (/ادبي/.test(normalized)) return "literary" as const;
  return "unknown" as const;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. The importer never writes personal data to local public files.",
    );
  }

  const report = JSON.parse(
    await readFile(
      path.join(process.cwd(), "reports", "sheets-inspection-report.json"),
      "utf8",
    ),
  ) as Inspection;
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 4,
    statement_timeout: 30_000,
  });
  const db = drizzle(pool);

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS student_results_name_trgm_idx
    ON student_results
    USING gin (student_name_normalized gin_trgm_ops)
  `);

  for (const workbookReport of report.workbooks) {
    if (!workbookReport.estimatedYear) {
      console.warn(`Skipping ${workbookReport.file}: year is not confirmed.`);
      continue;
    }
    const filePath = path.join(process.cwd(), "sheets", workbookReport.file);
    const bytes = await readFile(filePath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== workbookReport.sha256) {
      throw new Error(
        `${workbookReport.file} changed after inspection. Re-run inspect:sheets.`,
      );
    }

    const workbook = XLSX.read(bytes, { type: "buffer", dense: true, raw: true });
    let importedRows = 0;

    for (const sheetReport of workbookReport.sheets) {
      const sheet = workbook.Sheets[sheetReport.name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: true,
      });
      const dataRows = rows.slice(sheetReport.headerRow);
      const detected = sheetReport.detected;
      if (!detected.name || !detected.seatNumber) {
        console.warn(
          `Skipping ${workbookReport.file}/${sheetReport.name}: required mapping missing.`,
        );
        continue;
      }

      const educationSystem: "new" | "old" | "unknown" =
        sheetReport.likelyEducationSystems.length === 1
          ? sheetReport.likelyEducationSystems[0]
          : "unknown";
      const configuredMax =
        educationSystem === "unknown"
          ? null
          : getMaxScore(workbookReport.estimatedYear, educationSystem);

      for (let offset = 0; offset < dataRows.length; offset += BATCH_SIZE) {
        const batch = dataRows
          .slice(offset, offset + BATCH_SIZE)
          .map((row) => {
            const name = String(row[detected.name!.index] ?? "").trim();
            const seatNumber = normalizeDigits(
              String(row[detected.seatNumber!.index] ?? ""),
            ).trim();
            if (!name || !seatNumber) return null;
            const totalScore = detected.totalScore
              ? numberValue(row[detected.totalScore.index])
              : null;
            const maxScore = configuredMax;
            if (
              totalScore !== null &&
              maxScore !== null &&
              (totalScore < 0 || totalScore > maxScore)
            ) {
              return null;
            }
            const subjectMarks = Object.fromEntries(
              sheetReport.subjectColumns
                .map((column) => [
                  column.label,
                  numberValue(row[column.index]),
                ])
                .filter((entry): entry is [string, number] => entry[1] !== null),
            );

            return {
              year: workbookReport.estimatedYear!,
              educationSystem,
              branch: detected.branch
                ? branchValue(row[detected.branch.index])
                : ("unknown" as const),
              seatNumber,
              studentNameOriginal: name,
              studentNameNormalized: normalizeArabicName(name),
              totalScore,
              maxScore,
              percentage:
                totalScore !== null && maxScore
                  ? (totalScore / maxScore) * 100
                  : null,
              resultStatus: detected.status
                ? String(row[detected.status.index] ?? "").trim() || null
                : null,
              schoolName: detected.school
                ? String(row[detected.school.index] ?? "").trim() || null
                : null,
              governorate: detected.governorate
                ? String(row[detected.governorate.index] ?? "").trim() || null
                : null,
              subjectMarks:
                Object.keys(subjectMarks).length > 0 ? subjectMarks : null,
              sourceFile: workbookReport.file,
              sourceSheet: sheetReport.name,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (!batch.length) continue;
        await db
          .insert(studentResults)
          .values(batch)
          .onConflictDoUpdate({
            target: [studentResults.year, studentResults.seatNumber],
            set: {
              studentNameOriginal: sql`excluded.student_name_original`,
              studentNameNormalized: sql`excluded.student_name_normalized`,
              totalScore: sql`excluded.total_score`,
              maxScore: sql`excluded.max_score`,
              percentage: sql`excluded.percentage`,
              resultStatus: sql`excluded.result_status`,
              schoolName: sql`excluded.school_name`,
              governorate: sql`excluded.governorate`,
              subjectMarks: sql`excluded.subject_marks`,
              sourceFile: sql`excluded.source_file`,
              sourceSheet: sql`excluded.source_sheet`,
              importedAt: sql`now()`,
            },
          });
        importedRows += batch.length;
        console.log(
          `${workbookReport.file}/${sheetReport.name}: ${importedRows.toLocaleString()} rows`,
        );
      }
    }

    await db
      .insert(importSources)
      .values({
        fileName: workbookReport.file,
        sha256: hash,
        year: workbookReport.estimatedYear,
        rowCount: importedRows,
      })
      .onConflictDoUpdate({
        target: importSources.sha256,
        set: { rowCount: importedRows, importedAt: sql`now()` },
      });
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

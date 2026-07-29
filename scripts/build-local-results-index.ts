import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as XLSX from "xlsx";
import { normalizeArabicName, normalizeDigits } from "../lib/normalize-arabic";

const YEAR = 2026;
const MAX_SCORE = 320;
const PRIVATE_DATA_DIR = path.resolve(process.cwd(), "data", "private");
const OUTPUT_PATH = path.join(PRIVATE_DATA_DIR, "results-2026-v2.sqlite");
const TEMP_PATH = path.join(PRIVATE_DATA_DIR, "results-2026-v2.building.sqlite");
const SOURCE_PATH = path.resolve(process.cwd(), "sheets", "2026 sheet.xlsx");
const EXPECTED_SHA256 =
  "10505889431ae00b31b6c4cdf7c37fd0e34a5d082a81d1456ac0bbee8f663671";

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(normalizeDigits(String(value ?? "")));
  return Number.isFinite(parsed) ? parsed : null;
}

function main() {
  if (existsSync(OUTPUT_PATH)) {
    throw new Error(
      `Local results index already exists at ${OUTPUT_PATH}. Remove it explicitly before rebuilding.`,
    );
  }

  mkdirSync(PRIVATE_DATA_DIR, { recursive: true });
  rmSync(TEMP_PATH, { force: true });

  const sourceBytes = readFileSync(SOURCE_PATH);
  const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
  if (sourceHash !== EXPECTED_SHA256) {
    throw new Error(
      "The 2026 workbook changed after inspection. Re-run the inspection before indexing it.",
    );
  }

  console.log("Reading the verified 2026 workbook...");
  const workbook = XLSX.read(sourceBytes, {
    type: "buffer",
    dense: true,
    raw: true,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });

  const database = new DatabaseSync(TEMP_PATH);
  database.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;
    CREATE TABLE student_results (
      id INTEGER PRIMARY KEY,
      year INTEGER NOT NULL,
      education_system TEXT NOT NULL,
      branch TEXT NOT NULL,
      seat_number TEXT NOT NULL,
      student_name_original TEXT NOT NULL,
      student_name_normalized TEXT NOT NULL,
      total_score REAL,
      max_score REAL,
      percentage REAL,
      national_rank INTEGER,
      result_status TEXT,
      school_name TEXT,
      governorate TEXT
    );
    CREATE UNIQUE INDEX student_results_year_seat_idx
      ON student_results(year, seat_number);
    CREATE INDEX student_results_year_score_idx
      ON student_results(year, total_score DESC);
    CREATE TABLE result_metadata (
      year INTEGER PRIMARY KEY,
      total_students INTEGER NOT NULL
    );
  `);

  const insert = database.prepare(`
    INSERT INTO student_results (
      year,
      education_system,
      branch,
      seat_number,
      student_name_original,
      student_name_normalized,
      total_score,
      max_score,
      percentage,
      national_rank,
      result_status,
      school_name,
      governorate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");
  let inserted = 0;
  try {
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const seatNumber = normalizeDigits(String(row[0] ?? "")).trim();
      const studentName = String(row[1] ?? "").trim();
      if (!seatNumber || !studentName) continue;

      const totalScore = numericValue(row[2]);
      const percentage =
        totalScore === null ? null : (totalScore / MAX_SCORE) * 100;
      const status = String(row[3] ?? "").trim() || null;

      insert.run(
        YEAR,
        "new",
        "unknown",
        seatNumber,
        studentName,
        normalizeArabicName(studentName).toLowerCase(),
        totalScore,
        MAX_SCORE,
        percentage,
        null,
        status,
        null,
        null,
      );
      inserted += 1;
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    database.close();
    throw error;
  }

  console.log("Building the private name-search index...");
  database.exec(`
    INSERT INTO result_metadata (year, total_students)
    VALUES (${YEAR}, ${inserted});

    CREATE TEMP TABLE calculated_ranks AS
    SELECT
      id,
      RANK() OVER (ORDER BY total_score DESC) AS national_rank
    FROM student_results
    WHERE total_score IS NOT NULL;

    CREATE UNIQUE INDEX calculated_ranks_id_idx
      ON calculated_ranks(id);

    UPDATE student_results
    SET national_rank = (
      SELECT calculated_ranks.national_rank
      FROM calculated_ranks
      WHERE calculated_ranks.id = student_results.id
    );

    DROP TABLE calculated_ranks;
    CREATE INDEX student_results_national_rank_idx
      ON student_results(year, national_rank);

    CREATE VIRTUAL TABLE student_results_fts USING fts5(
      student_name_normalized,
      content = 'student_results',
      content_rowid = 'id',
      tokenize = 'trigram'
    );
    INSERT INTO student_results_fts(student_results_fts) VALUES ('rebuild');
    ANALYZE;
  `);
  database.close();

  renameSync(TEMP_PATH, OUTPUT_PATH);
  console.log(
    `Indexed ${inserted.toLocaleString("en-US")} private 2026 results at ${OUTPUT_PATH}.`,
  );
}

try {
  main();
} catch (error) {
  rmSync(TEMP_PATH, { force: true });
  console.error(error);
  process.exitCode = 1;
}

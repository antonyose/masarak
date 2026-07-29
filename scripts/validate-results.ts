import { readFile } from "node:fs/promises";
import path from "node:path";

type InspectionReport = {
  workbooks: Array<{
    file: string;
    estimatedYear: number | null;
    sheets: Array<{
      name: string;
      rowCount: number;
      detected: Record<string, { label: string } | undefined>;
      score: { minimum: number | null; maximum: number | null };
      duplicateSeatNumbers: number | null;
    }>;
  }>;
};

const reportPath = path.join(
  process.cwd(),
  "reports",
  "sheets-inspection-report.json",
);

async function main() {
  const report = JSON.parse(
    await readFile(reportPath, "utf8"),
  ) as InspectionReport;
  let errors = 0;

  for (const workbook of report.workbooks) {
    for (const sheet of workbook.sheets) {
      const prefix = `${workbook.file} / ${sheet.name}`;
      for (const required of ["name", "seatNumber", "totalScore"] as const) {
        if (!sheet.detected[required]) {
          console.error(`[ERROR] ${prefix}: missing ${required} mapping`);
          errors += 1;
        }
      }
      if ((sheet.duplicateSeatNumbers ?? 0) > 0) {
        console.warn(
          `[WARN] ${prefix}: ${sheet.duplicateSeatNumbers} duplicate seat numbers`,
        );
      }
      if (sheet.score.minimum !== null && sheet.score.minimum < 0) {
        console.error(`[ERROR] ${prefix}: negative score detected`);
        errors += 1;
      }
      if (sheet.score.maximum !== null && sheet.score.maximum > 410) {
        console.warn(
          `[WARN] ${prefix}: observed score ${sheet.score.maximum} is above configured scales`,
        );
      }
    }
  }

  if (errors) {
    throw new Error(`Validation failed with ${errors} mapping/data errors.`);
  }
  console.log("Inspection report passed structural validation.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

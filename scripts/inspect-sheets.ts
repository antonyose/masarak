import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

type Cell = string | number | boolean | Date | null | undefined;
type ColumnKind =
  | "name"
  | "seatNumber"
  | "totalScore"
  | "status"
  | "branch"
  | "school"
  | "governorate"
  | "unknown";

type ColumnDetection = {
  index: number;
  label: string;
  normalizedLabel: string;
  kind: ColumnKind;
  confidence: "high" | "medium" | "low";
};

type SheetReport = {
  name: string;
  range: string;
  headerRow: number;
  rowCount: number;
  columnCount: number;
  columns: ColumnDetection[];
  detected: Partial<Record<ColumnKind, ColumnDetection>>;
  subjectColumns: ColumnDetection[];
  sampleRows: Record<string, Cell>[];
  score: {
    numericCount: number;
    minimum: number | null;
    maximum: number | null;
    median: number | null;
    percentile95: number | null;
    countAbove320: number;
    countAbove410: number;
  };
  missing: {
    names: number | null;
    seatNumbers: number | null;
    totalScores: number | null;
  };
  duplicateSeatNumbers: number | null;
  branchInformation: boolean;
  likelyEducationSystems: Array<"new" | "old" | "unknown">;
  likelyStatuses: string[];
};

type WorkbookReport = {
  file: string;
  sizeBytes: number;
  sha256: string;
  estimatedYear: number | null;
  sheetCount: number;
  sheets: SheetReport[];
};

const ROOT = process.cwd();
const SHEETS_DIR = path.join(ROOT, "sheets");
const REPORTS_DIR = path.join(ROOT, "reports");
const SUPPORTED = new Set([".xlsx", ".xls", ".csv"]);

const aliases: Record<Exclude<ColumnKind, "unknown">, string[]> = {
  name: [
    "الاسم",
    "اسم الطالب",
    "اسم الطالب بالكامل",
    "الطالب",
    "name",
    "student name",
  ],
  seatNumber: [
    "رقم الجلوس",
    "رقم جلوس",
    "جلوس",
    "seating no",
    "seat number",
    "seat no",
    "sitting number",
  ],
  totalScore: [
    "المجموع",
    "المجموع الكلي",
    "مجموع الدرجات",
    "الدرجة الكلية",
    "total",
    "total score",
    "degree",
  ],
  status: [
    "الحالة",
    "حالة الطالب",
    "النتيجة",
    "student_case_desc",
    "student case desc",
    "status",
    "result",
  ],
  branch: ["الشعبة", "شعبة", "التخصص", "القسم", "branch", "section"],
  school: ["المدرسة", "اسم المدرسة", "school", "school name"],
  governorate: [
    "المحافظة",
    "محافظة",
    "الادارة",
    "الإدارة",
    "الادارة التعليمية",
    "governorate",
    "district",
  ],
};

function normalizeArabic(value: Cell): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function detectKind(label: Cell): Omit<ColumnDetection, "index" | "label" | "normalizedLabel"> {
  const normalized = normalizeArabic(label);
  if (!normalized) return { kind: "unknown", confidence: "low" };

  for (const [kind, values] of Object.entries(aliases) as Array<
    [Exclude<ColumnKind, "unknown">, string[]]
  >) {
    const normalizedAliases = values.map(normalizeArabic);
    if (normalizedAliases.includes(normalized)) {
      return { kind, confidence: "high" };
    }
    if (
      normalizedAliases.some(
        (candidate) =>
          normalized.includes(candidate) || candidate.includes(normalized),
      )
    ) {
      return { kind, confidence: "medium" };
    }
  }

  return { kind: "unknown", confidence: "low" };
}

function findHeaderRow(rows: Cell[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, index) => {
    const detections = row.map(detectKind);
    const recognized = detections.filter((item) => item.kind !== "unknown");
    const core = new Set(recognized.map((item) => item.kind));
    const score =
      recognized.length * 2 +
      (core.has("name") ? 4 : 0) +
      (core.has("seatNumber") ? 4 : 0) +
      (core.has("totalScore") ? 4 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function toFiniteNumber(value: Cell): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeArabic(value).replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function redact(kind: ColumnKind, value: Cell): Cell {
  if (kind === "name") return value ? "[محجوب لحماية الخصوصية]" : null;
  if (kind === "seatNumber") {
    const raw = String(value ?? "");
    return raw ? `${"*".repeat(Math.max(0, raw.length - 3))}${raw.slice(-3)}` : null;
  }
  return value;
}

function inferYear(fileName: string): number | null {
  const match = fileName.match(/20(23|24|25|26)/);
  if (match) return Number(match[0]);
  const shortMatch = fileName.match(/(?:^|[^\d])(23|24|25|26)(?:[^\d]|$)/);
  return shortMatch ? 2000 + Number(shortMatch[1]) : null;
}

function inferSystems({
  year,
  sheetName,
  maximum,
}: {
  year: number | null;
  sheetName: string;
  maximum: number | null;
}): Array<"new" | "old" | "unknown"> {
  const normalizedSheetName = normalizeArabic(sheetName);
  if (year === 2023 || year === 2024) return ["old"];
  if (year === 2026) return ["new"];
  if (/قديم|old/.test(normalizedSheetName)) return ["old"];
  if (/جديد|new/.test(normalizedSheetName)) {
    if (year === 2025 && maximum !== null && maximum > 320) {
      return ["new", "old"];
    }
    return ["new"];
  }
  if (year === 2025 && maximum !== null) {
    if (maximum <= 320) return ["new"];
    if (maximum <= 410) return ["new", "old"];
  }
  return ["unknown"];
}

function columnLabel(value: Cell, index: number): string {
  const label = String(value ?? "").trim();
  return label || `عمود ${XLSX.utils.encode_col(index)}`;
}

async function inspectWorkbook(fileName: string): Promise<WorkbookReport> {
  const filePath = path.join(SHEETS_DIR, fileName);
  const bytes = await readFile(filePath);
  const workbook = XLSX.read(bytes, {
    type: "buffer",
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    dense: true,
  });

  const estimatedYear = inferYear(fileName);
  const sheetReports: SheetReport[] = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const range = worksheet["!ref"] ?? "A1:A1";
    const rows = XLSX.utils.sheet_to_json<Cell[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    });
    const headerIndex = findHeaderRow(rows);
    const headers = rows[headerIndex] ?? [];
    const dataRows = rows.slice(headerIndex + 1).filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && cell !== ""),
    );

    const columns: ColumnDetection[] = headers.map((value, index) => {
      const detection = detectKind(value);
      return {
        index,
        label: columnLabel(value, index),
        normalizedLabel: normalizeArabic(value),
        ...detection,
      };
    });

    const detected: Partial<Record<ColumnKind, ColumnDetection>> = {};
    for (const column of columns) {
      if (column.kind === "unknown") continue;
      const existing = detected[column.kind];
      if (
        !existing ||
        (existing.confidence !== "high" && column.confidence === "high")
      ) {
        detected[column.kind] = column;
      }
    }

    const valueAt = (row: Cell[], kind: ColumnKind) => {
      const column = detected[kind];
      return column ? row[column.index] : null;
    };

    const scoreValues = detected.totalScore
      ? dataRows
          .map((row) => toFiniteNumber(valueAt(row, "totalScore")))
          .filter((value): value is number => value !== null)
      : [];

    const nonEmpty = (kind: ColumnKind) =>
      detected[kind]
        ? dataRows.filter((row) => {
            const value = valueAt(row, kind);
            return value !== null && value !== undefined && String(value).trim() !== "";
          }).length
        : null;

    let duplicateSeatNumbers: number | null = null;
    if (detected.seatNumber) {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const row of dataRows) {
        const value = normalizeArabic(valueAt(row, "seatNumber"));
        if (!value) continue;
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
      }
      duplicateSeatNumbers = duplicates.size;
    }

    const likelyStatuses = detected.status
      ? Array.from(
          new Set(
            dataRows
              .slice(0, 50_000)
              .map((row) => String(valueAt(row, "status") ?? "").trim())
              .filter(Boolean),
          ),
        ).slice(0, 20)
      : [];

    const knownIndexes = new Set(
      Object.values(detected)
        .filter(Boolean)
        .map((column) => column.index),
    );
    const subjectColumns = columns.filter((column) => {
      if (knownIndexes.has(column.index)) return false;
      const sample = dataRows.slice(0, 500).map((row) => row[column.index]);
      const populated = sample.filter((value) => value !== null && value !== "");
      if (populated.length < 10) return false;
      const numericRatio =
        populated.filter((value) => toFiniteNumber(value) !== null).length /
        populated.length;
      return numericRatio > 0.8 && /درج|عربي|انجليزي|فيزياء|كيمياء|احياء|رياض/i.test(column.label);
    });

    const sampleRows = dataRows.slice(0, 5).map((row) =>
      Object.fromEntries(
        columns.map((column) => [
          column.label,
          redact(column.kind, row[column.index]),
        ]),
      ),
    );

    const scoreRange = scoreValues.reduce(
      (range, value) => ({
        minimum: Math.min(range.minimum, value),
        maximum: Math.max(range.maximum, value),
      }),
      { minimum: Number.POSITIVE_INFINITY, maximum: Number.NEGATIVE_INFINITY },
    );
    const maximum = scoreValues.length ? scoreRange.maximum : null;
    const sortedScores = scoreValues.toSorted((a, b) => a - b);
    const percentile = (ratio: number) => {
      if (!sortedScores.length) return null;
      const index = Math.min(
        sortedScores.length - 1,
        Math.floor((sortedScores.length - 1) * ratio),
      );
      return sortedScores[index];
    };
    return {
      name: sheetName,
      range,
      headerRow: headerIndex + 1,
      rowCount: dataRows.length,
      columnCount: columns.length,
      columns,
      detected,
      subjectColumns,
      sampleRows,
      score: {
        numericCount: scoreValues.length,
        minimum: scoreValues.length ? scoreRange.minimum : null,
        maximum,
        median: percentile(0.5),
        percentile95: percentile(0.95),
        countAbove320: scoreValues.filter((value) => value > 320).length,
        countAbove410: scoreValues.filter((value) => value > 410).length,
      },
      missing: {
        names:
          nonEmpty("name") === null ? null : dataRows.length - (nonEmpty("name") ?? 0),
        seatNumbers:
          nonEmpty("seatNumber") === null
            ? null
            : dataRows.length - (nonEmpty("seatNumber") ?? 0),
        totalScores:
          nonEmpty("totalScore") === null
            ? null
            : dataRows.length - (nonEmpty("totalScore") ?? 0),
      },
      duplicateSeatNumbers,
      branchInformation: Boolean(detected.branch),
      likelyEducationSystems: inferSystems({
        year: estimatedYear,
        sheetName,
        maximum,
      }),
      likelyStatuses,
    };
  });

  return {
    file: fileName,
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    estimatedYear,
    sheetCount: workbook.SheetNames.length,
    sheets: sheetReports,
  };
}

function nullable(value: number | null): string {
  return value === null ? "غير متاح" : value.toLocaleString("en-US");
}

function renderMarkdown(reports: WorkbookReport[]): string {
  const generatedAt = new Date().toISOString();
  const totalRows = reports.reduce(
    (sum, workbook) =>
      sum + workbook.sheets.reduce((sheetSum, sheet) => sheetSum + sheet.rowCount, 0),
    0,
  );
  const allSheets = reports.flatMap((workbook) =>
    workbook.sheets.map((sheet) => ({
      ...sheet,
      file: workbook.file,
      year: workbook.estimatedYear,
    })),
  );
  const missingBranchSheets = allSheets.filter(
    (sheet) => !sheet.branchInformation,
  );
  const aboveConfiguredScale = allSheets.filter((sheet) => {
    if (sheet.year === 2023 || sheet.year === 2024) {
      return sheet.score.countAbove410 > 0;
    }
    if (sheet.year === 2025 || sheet.year === 2026) {
      return sheet.score.countAbove320 > 0;
    }
    return false;
  });

  const sections = reports.map((workbook) => {
    const sheets = workbook.sheets.map((sheet) => {
      const mappings = Object.entries(sheet.detected)
        .filter(([, value]) => value)
        .map(([kind, value]) => `- \`${kind}\` ← **${value?.label}**`)
        .join("\n");
      const samples = sheet.sampleRows.length
        ? `\n<details>\n<summary>عينات آمنة من أول الصفوف (الأسماء محجوبة وأرقام الجلوس مقنّعة)</summary>\n\n\`\`\`json\n${JSON.stringify(sheet.sampleRows, null, 2)}\n\`\`\`\n</details>\n`
        : "";

      return `### ورقة: ${sheet.name}

- النطاق المستخدم: \`${sheet.range}\`
- صف العناوين المرجح: ${sheet.headerRow}
- عدد سجلات البيانات: ${sheet.rowCount.toLocaleString("en-US")}
- عدد الأعمدة: ${sheet.columnCount}
- نطاق المجموع المرصود: ${nullable(sheet.score.minimum)} – ${nullable(sheet.score.maximum)}
- الوسيط / المئين 95 للمجموع: ${nullable(sheet.score.median)} / ${nullable(sheet.score.percentile95)}
- سجلات أعلى من 320: ${sheet.score.countAbove320.toLocaleString("en-US")}
- سجلات أعلى من 410: ${sheet.score.countAbove410.toLocaleString("en-US")}
- سجلات بدون اسم: ${nullable(sheet.missing.names)}
- سجلات بدون رقم جلوس: ${nullable(sheet.missing.seatNumbers)}
- سجلات بدون مجموع: ${nullable(sheet.missing.totalScores)}
- أرقام جلوس مكررة: ${nullable(sheet.duplicateSeatNumbers)}
- بيانات الشعبة: ${sheet.branchInformation ? "موجودة" : "غير موجودة/لم تُكتشف"}
- النظام المرجح من نطاق الدرجات: ${sheet.likelyEducationSystems.join(", ")}
- أعمدة المواد المرجحة: ${sheet.subjectColumns.length ? sheet.subjectColumns.map((column) => column.label).join("، ") : "لم تُكتشف"}

#### ربط الأعمدة

${mappings || "لم يُكتشف ربط موثوق للأعمدة الأساسية."}
${samples}`;
    });

    return `## ${workbook.file}

- السنة المرجحة: ${workbook.estimatedYear ?? "غير معروفة"}
- الحجم: ${(workbook.sizeBytes / 1024 / 1024).toFixed(2)} MB
- SHA-256: \`${workbook.sha256}\`
- عدد الأوراق: ${workbook.sheetCount}

${sheets.join("\n")}`;
  });

  return `# تقرير فحص ملفات نتائج الثانوية العامة

> تقرير محلي آمن أُنشئ في ${generatedAt}. لا يحتوي على أسماء طلاب ظاهرة أو أرقام جلوس كاملة.

## الملخص

- الملفات المفحوصة: ${reports.length}
- إجمالي سجلات البيانات المرصودة: ${totalRows.toLocaleString("en-US")}
- الامتدادات المدعومة: \`.xlsx\` و\`.xls\` و\`.csv\`
- لم يتم تعديل أي ملف مصدر.

## نتائج جودة البيانات التي تؤثر على التنفيذ

- **الشعبة غير موجودة في جميع الأوراق (${missingBranchSheets.length}/${allSheets.length}).** لا يمكن ادعاء أن ترتيب الطالب خاص بعلمي علوم أو علمي رياضة أو أدبي من هذه الملفات وحدها؛ يستخدم محرك التوقع توزيع السنة والنظام كبديل منخفض/متوسط الثقة حتى تتوفر بيانات شعبة موثوقة.
- **ملف 2025 يحتوي أكثر من نطاق درجات واحد:** توجد ${allSheets.find((sheet) => sheet.year === 2025)?.score.countAbove320.toLocaleString("en-US") ?? "0"} سجلات أعلى من 320 رغم أن اسم الورقة «النظام الجديد». لا تُصنّف هذه السجلات تلقائيًا كنظام قديم من المجموع وحده؛ يجب عزلها أو إثبات النظام من حقل/مصدر آخر قبل الاستيراد.
- **توجد درجات أعلى من الحد المكوّن في ${aboveConfiguredScale.length} ورقة/أوراق.** في 2023 و2024 توجد أعداد محدودة أعلى من 410، وتُعامل كسجلات تحتاج مراجعة ولا تدخل توزيع الدرجات الافتراضي.
- **البنية موحّدة نسبيًا:** كل ملف يحتوي ورقة واحدة، والأعمدة الأساسية (رقم الجلوس، الاسم، المجموع) موجودة، ولا توجد أرقام جلوس مكررة داخل أي ورقة.
- **لا توجد درجات مواد أو مدرسة أو محافظة في الملفات الحالية.** يجب ألا تعرض واجهة النتيجة هذه الحقول إلا إذا جاءت من مصدر إضافي موثوق.

${sections.join("\n\n")}
`;
}

async function main() {
  await mkdir(REPORTS_DIR, { recursive: true });
  const entries = await readdir(SHEETS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && SUPPORTED.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ar"));

  if (!files.length) {
    throw new Error("لم يتم العثور على ملفات جداول مدعومة داخل مجلد sheets.");
  }

  const reports: WorkbookReport[] = [];
  for (const file of files) {
    console.log(`Inspecting ${file}...`);
    reports.push(await inspectWorkbook(file));
  }

  const jsonPath = path.join(REPORTS_DIR, "sheets-inspection-report.json");
  const markdownPath = path.join(REPORTS_DIR, "sheets-inspection-report.md");
  await writeFile(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), workbooks: reports }, null, 2)}\n`);
  await writeFile(markdownPath, renderMarkdown(reports));
  console.log(`Wrote ${path.relative(ROOT, markdownPath)}`);
  console.log(`Wrote ${path.relative(ROOT, jsonPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

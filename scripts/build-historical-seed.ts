import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeArabicName } from "../lib/normalize-arabic";

type Branch = "science" | "mathematics" | "literary";

const sources = [
  { year: 2025, group: "scientific", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2025.htm", maximumScore: 320 },
  { year: 2025, group: "literary", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2025.htm", maximumScore: 320 },
  { year: 2024, group: "scientific", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2024.htm", maximumScore: 410 },
  { year: 2024, group: "literary", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2024.htm", maximumScore: 410 },
  { year: 2023, group: "scientific", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2023.htm", maximumScore: 410 },
  { year: 2023, group: "literary", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2023.htm", maximumScore: 410 },
] as const;

function normalizeLabel(value: string) {
  const normalized = value
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const nestedHeader = normalized.match(/.*الكلية\s+الحد\s+الأدن[ىي]\s+(.+)$/u);
  return (nestedHeader?.[1] ?? normalized).trim();
}

function facultyKey(label: string) {
  return normalizeArabicName(label)
    .replace(/\s+(علوم|رياضة|رياضه)$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function scientificBranch(label: string): Branch {
  return /(?:^هندسة|تخطيط عمراني|فنون تطبيقية|\sرياض(?:ة|ه)$)/u.test(label)
    ? "mathematics"
    : "science";
}

async function main() {
  const rows: Array<Record<string, unknown>> = [];
  const sourceMetadata: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Failed ${response.status}: ${source.url}`);
    const html = await response.text();
    const rowPattern = /<tr>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>([\d.]+)<\/td>\s*<\/tr>/gis;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = rowPattern.exec(html))) {
      const officialNameArabic = normalizeLabel(match[1]);
      const minimumScore = Number(match[2]);
      if (!officialNameArabic || officialNameArabic.length > 180 || !Number.isFinite(minimumScore)) continue;
      rows.push({
        year: source.year,
        educationSystem: source.year === 2025 ? "new" : "old",
        branch: source.group === "literary" ? "literary" : scientificBranch(officialNameArabic),
        facultyKey: facultyKey(officialNameArabic),
        officialNameArabic,
        minimumScore,
        maximumScore: source.maximumScore,
        minimumPercentage: Number(((minimumScore / source.maximumScore) * 100).toFixed(4)),
        sourceUrl: source.url,
      });
      count += 1;
    }
    if (!count) throw new Error(`No cutoff rows parsed: ${source.url}`);
    sourceMetadata.push({ ...source, sha256: createHash("sha256").update(html).digest("hex"), rowCount: count });
  }

  const output = path.resolve(process.cwd(), "lib", "coordination-data", "historical-cutoffs-2023-2025.json");
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: sourceMetadata, rows }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${rows.length} official historical cutoff rows to ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

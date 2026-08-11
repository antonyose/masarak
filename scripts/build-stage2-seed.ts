import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeArabicName } from "../lib/normalize-arabic";

const sourcePath = path.resolve(
  process.cwd(),
  "TANSIK_2026_STAGE2_RESEARCH_CONTEXT.md",
);
const outputPath = path.resolve(
  process.cwd(),
  "lib",
  "coordination-data",
  "stage2-2026.json",
);

type Branch = "science" | "mathematics" | "literary";

function section(markdown: string, start: string, end: string) {
  const from = markdown.indexOf(start);
  const to = markdown.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing research section: ${start}`);
  return markdown.slice(from, to);
}

function keyFor(label: string) {
  return normalizeArabicName(label)
    .replace(/\s+(علوم|رياضة|رياضه)$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function cutoffRows(block: string, branchFor: (label: string) => Branch) {
  return block
    .split(/\r?\n/)
    .map((line) =>
      line.match(/^\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)%?\s*\|$/),
    )
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const officialNameArabic = match[1].trim();
      return {
        facultyKey: keyFor(officialNameArabic),
        officialNameArabic,
        score: Number(match[2]),
        maximumScore: 320,
        percentage: Number(match[3]),
        educationSystem: "new" as const,
        branch: branchFor(officialNameArabic),
        stage: 1 as const,
      };
    });
}

function vacancyRows(block: string) {
  let currentBranch: Branch | null = null;
  let aptitudeSection = false;
  const rows: Array<{
    facultyKey: string;
    officialNameArabic: string;
    educationSystem: "new";
    branch: Branch;
    stage: 2;
    requiresAptitudeTest: boolean;
  }> = [];

  for (const line of block.split(/\r?\n/)) {
    const heading = line.match(/^## 7\.(\d+)/);
    if (heading) {
      const number = Number(heading[1]);
      currentBranch = number === 9 ? "literary" : number >= 5 ? "mathematics" : "science";
      aptitudeSection = number === 8;
      continue;
    }
    const bullet = line.match(/^- (.+)$/);
    if (!bullet || !currentBranch) continue;
    const officialNameArabic = bullet[1].trim();
    const aptitudeName = /(فنون|تربية رياضية|علوم الرياضة)/u.test(
      officialNameArabic,
    );
    rows.push({
      facultyKey: keyFor(officialNameArabic),
      officialNameArabic,
      educationSystem: "new",
      branch: currentBranch,
      stage: 2,
      requiresAptitudeTest: aptitudeSection || aptitudeName,
    });
  }
  return rows;
}

const markdown = readFileSync(sourcePath, "utf8");
const scientific = cutoffRows(
  section(markdown, "# 5. Full Stage-1", "# 6. Full Stage-1"),
  (label) => (/^هندسة| رياضة$/u.test(label) ? "mathematics" : "science"),
);
const literary = cutoffRows(
  section(markdown, "# 6. Full Stage-1", "# 7. Stage-2"),
  () => "literary",
);
const vacancies = vacancyRows(
  section(markdown, "# 7. Stage-2", "# 8. What must"),
);

const seed = {
  metadata: {
    year: 2026,
    currentStage: 2,
    frozenAt: "2026-08-11T00:00:00+03:00",
    registrationOpensAt: "2026-08-12T00:00:00+03:00",
    registrationClosesAt: "2026-08-16T23:59:59+03:00",
    sourceSha256: createHash("sha256").update(markdown).digest("hex"),
  },
  stageRules: [
    { stage: 2, educationSystem: "new", branch: "science", minimumScore: 220, maximumScore: 320, minimumPercentage: 68.75, studentCount: 234866 },
    { stage: 2, educationSystem: "new", branch: "mathematics", minimumScore: 220, maximumScore: 320, minimumPercentage: 68.75, studentCount: 234866 },
    { stage: 2, educationSystem: "new", branch: "literary", minimumScore: 205, maximumScore: 320, minimumPercentage: 64.06, studentCount: 31610 },
    { stage: 2, educationSystem: "old", branch: "science", minimumScore: 280, maximumScore: 410, minimumPercentage: 68.29, studentCount: 379 },
    { stage: 2, educationSystem: "old", branch: "mathematics", minimumScore: 280, maximumScore: 410, minimumPercentage: 68.29, studentCount: 379 },
    { stage: 2, educationSystem: "old", branch: "literary", minimumScore: 240, maximumScore: 410, minimumPercentage: 58.53, studentCount: 76 },
  ],
  sources: [
    { key: "research-context", tier: "A", publisher: "Masarak frozen research context", url: "local:TANSIK_2026_STAGE2_RESEARCH_CONTEXT.md" },
    { key: "stage1-scientific", tier: "A", publisher: "Tansik", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2026.htm" },
    { key: "stage1-literary", tier: "A", publisher: "Tansik", url: "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2026.htm" },
    { key: "stage2-scientific-vacancies", tier: "B", publisher: "Youm7 frozen mirror", url: "https://www.youm7.com/story/2026/8/11/تنسيق-المرحلة-الثانية-القائمة-الكامل-للكليات-والمعاهد-الشاغرة-أمام-الطلاب/7510195" },
    { key: "stage2-literary-vacancies", tier: "B", publisher: "Youm7 frozen mirror", url: "https://www.youm7.com/story/2026/8/10/الأماكن-الشاغرة-بتنسيق-المرحلة-الثانية-للثانوية-العامة-بالشعبة-الأدبية/7509321" },
  ],
  officialCutoffs: [...scientific, ...literary],
  stageVacancies: vacancies,
  model: {
    version: "stage2-2026-v1",
    mode: "normalized_percentage",
    historicalWeights: { "2025": 0.5, "2024": 0.3, "2023": 0.2 },
    minimumUncertainty: 0.65,
    confidencePenaltyWithoutBranchDistribution: 1,
    classificationBoundaries: {
      safeUncertaintyMultiple: 1,
      targetLowerMultiple: -0.35,
      reachLowerMultiple: -1,
    },
  },
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${scientific.length + literary.length} cutoffs and ${vacancies.length} vacancies to ${outputPath}`,
);

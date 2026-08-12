import { createHash } from "node:crypto";
import type { Branch } from "@/lib/grade-scales";
import { egyptianGovernorates } from "@/lib/governorates";
import { normalizeArabicName } from "@/lib/normalize-arabic";
import type {
  AliasResolutionStatus,
  InstitutionClass,
  PublicInstitutionClass,
} from "@/lib/prediction-v2/types";

type InstitutionRule = {
  id: string;
  officialNameArabic: string;
  institutionClass: PublicInstitutionClass;
  governorate: string | null;
  patterns: string[];
};

export const institutionRules: InstitutionRule[] = [
  { id: "cairo", officialNameArabic: "جامعة القاهرة", institutionClass: "public_university", governorate: "القاهرة", patterns: ["القاهرة"] },
  { id: "alexandria", officialNameArabic: "جامعة الإسكندرية", institutionClass: "public_university", governorate: "الإسكندرية", patterns: ["الاسكندرية", "اسكندرية"] },
  { id: "ain-shams", officialNameArabic: "جامعة عين شمس", institutionClass: "public_university", governorate: "القاهرة", patterns: ["عين شمس"] },
  { id: "assiut", officialNameArabic: "جامعة أسيوط", institutionClass: "public_university", governorate: "أسيوط", patterns: ["اسيوط"] },
  { id: "tanta", officialNameArabic: "جامعة طنطا", institutionClass: "public_university", governorate: "الغربية", patterns: ["طنطا"] },
  { id: "mansoura", officialNameArabic: "جامعة المنصورة", institutionClass: "public_university", governorate: "الدقهلية", patterns: ["المنصورة", "منية النصر", "ميت غمر"] },
  { id: "zagazig", officialNameArabic: "جامعة الزقازيق", institutionClass: "public_university", governorate: "الشرقية", patterns: ["الزقازيق", "فاقوس"] },
  { id: "helwan", officialNameArabic: "جامعة العاصمة (حلوان سابقًا)", institutionClass: "public_university", governorate: "القاهرة", patterns: ["العاصمة", "حلوان", "الزمالك", "المنيل", "بالجزيرة"] },
  { id: "minia", officialNameArabic: "جامعة المنيا", institutionClass: "public_university", governorate: "المنيا", patterns: ["المنيا"] },
  { id: "menoufia", officialNameArabic: "جامعة المنوفية", institutionClass: "public_university", governorate: "المنوفية", patterns: ["المنوفية", "شبين الكوم", "اشمون"] },
  { id: "suez-canal", officialNameArabic: "جامعة قناة السويس", institutionClass: "public_university", governorate: "الإسماعيلية", patterns: ["قناة السويس", "الاسماعيلية"] },
  { id: "south-valley", officialNameArabic: "جامعة قنا (جنوب الوادي سابقًا)", institutionClass: "public_university", governorate: "قنا", patterns: ["جنوب الوادي", "قنا"] },
  { id: "beni-suef", officialNameArabic: "جامعة بني سويف", institutionClass: "public_university", governorate: "بني سويف", patterns: ["بني سويف", "بنى سويف"] },
  { id: "fayoum", officialNameArabic: "جامعة الفيوم", institutionClass: "public_university", governorate: "الفيوم", patterns: ["الفيوم"] },
  { id: "banha", officialNameArabic: "جامعة بنها", institutionClass: "public_university", governorate: "القليوبية", patterns: ["بنها"] },
  { id: "kafr-el-sheikh", officialNameArabic: "جامعة كفر الشيخ", institutionClass: "public_university", governorate: "كفر الشيخ", patterns: ["كفر الشيخ", "كفرالشيخ"] },
  { id: "sohag", officialNameArabic: "جامعة سوهاج", institutionClass: "public_university", governorate: "سوهاج", patterns: ["سوهاج"] },
  { id: "port-said", officialNameArabic: "جامعة بورسعيد", institutionClass: "public_university", governorate: "بورسعيد", patterns: ["بور سعيد", "بورسعيد"] },
  { id: "damietta", officialNameArabic: "جامعة دمياط", institutionClass: "public_university", governorate: "دمياط", patterns: ["دمياط"] },
  { id: "aswan", officialNameArabic: "جامعة أسوان", institutionClass: "public_university", governorate: "أسوان", patterns: ["اسوان"] },
  { id: "damanhour", officialNameArabic: "جامعة دمنهور", institutionClass: "public_university", governorate: "البحيرة", patterns: ["دمنهور", "النوبارية"] },
  { id: "suez", officialNameArabic: "جامعة السويس", institutionClass: "public_university", governorate: "السويس", patterns: ["السويس"] },
  { id: "sadat", officialNameArabic: "جامعة مدينة السادات", institutionClass: "public_university", governorate: "المنوفية", patterns: ["مدينة السادات", "السادات"] },
  { id: "arish", officialNameArabic: "جامعة العريش", institutionClass: "public_university", governorate: "شمال سيناء", patterns: ["العريش"] },
  { id: "new-valley", officialNameArabic: "جامعة الوادي الجديد", institutionClass: "public_university", governorate: "الوادي الجديد", patterns: ["الوادي الجديد"] },
  { id: "matrouh", officialNameArabic: "جامعة مطروح", institutionClass: "public_university", governorate: "مطروح", patterns: ["مطروح"] },
  { id: "luxor", officialNameArabic: "جامعة الأقصر", institutionClass: "public_university", governorate: "الأقصر", patterns: ["الاقصر"] },
  { id: "hurghada", officialNameArabic: "جامعة الغردقة", institutionClass: "public_university", governorate: "البحر الأحمر", patterns: ["الغردقة"] },
  { id: "new-cairo-tech", officialNameArabic: "جامعة القاهرة الجديدة التكنولوجية", institutionClass: "public_technological_university", governorate: "القاهرة", patterns: ["القاهرة الجديدة التكنولوجية"] },
  { id: "delta-tech", officialNameArabic: "جامعة الدلتا التكنولوجية", institutionClass: "public_technological_university", governorate: "المنوفية", patterns: ["الدلتا التكنولوجية"] },
  { id: "beni-suef-tech", officialNameArabic: "جامعة بني سويف التكنولوجية", institutionClass: "public_technological_university", governorate: "بني سويف", patterns: ["بني سويف التكنولوجية", "بنى سويف التكنولوجية"] },
  { id: "october-tech", officialNameArabic: "جامعة 6 أكتوبر التكنولوجية", institutionClass: "public_technological_university", governorate: "الجيزة", patterns: ["6 اكتوبر التكنولوجية"] },
  { id: "borg-el-arab-tech", officialNameArabic: "جامعة برج العرب التكنولوجية", institutionClass: "public_technological_university", governorate: "الإسكندرية", patterns: ["برج العرب التكنولوجية"] },
  { id: "assiut-tech", officialNameArabic: "جامعة أسيوط الجديدة التكنولوجية", institutionClass: "public_technological_university", governorate: "أسيوط", patterns: ["اسيوط التكنولوجية", "باسيوط"] },
  { id: "samanoud-tech", officialNameArabic: "جامعة سمنود التكنولوجية", institutionClass: "public_technological_university", governorate: "الغربية", patterns: ["سمنود التكنولوجية"] },
  { id: "taiba-tech", officialNameArabic: "جامعة طيبة الجديدة التكنولوجية", institutionClass: "public_technological_university", governorate: "الأقصر", patterns: ["طيبة التكنولوجية", "طيبة"] },
  { id: "east-port-said-tech", officialNameArabic: "جامعة شرق بورسعيد التكنولوجية", institutionClass: "public_technological_university", governorate: "بورسعيد", patterns: ["شرق بورسعيد التكنولوجية", "شرق بور سعيد التكنولوجية", "شرق بورسعيد", "شرق بور سعيد"] },
  { id: "misr-international-tech", officialNameArabic: "جامعة مصر الدولية التكنولوجية", institutionClass: "public_technological_university", governorate: null, patterns: ["مصر الدولية التكنولوجية"] },
];

const publicFacultyPrefixes = [
  "طب", "تمريض", "علوم", "حاسبات", "ذكاء اصطناعي", "الذكاء الاصطناعي",
  "هندسة", "زراعة", "تربية", "حقوق", "اعلام", "اداب", "تجارة", "السن",
  "اقتصاد", "سياسة", "الدراسات الاقتصادية", "فنون تطبيقية", "فنون جميلة",
  "اثار", "سياحة وفنادق", "سياحه وفنادق", "خدمة اجتماعية", "دار العلوم",
  "اقتصاد منزلي", "تكنولوجيا وتنمية", "الملاحة وتكنولوجيا الفضاء", "تخطيط عمراني",
  "العلوم الصحية التطبيقية", "علوم صحية تطبيقية", "علاج طبيعي", "صيدلة",
  "الثروة السمكية", "علوم التغذية", "التعليم الصناعي", "التربية النوعية",
  "الاستزراع المائي", "الاعاقة والتاهيل", "التكنولوجيا والتعليم الصناعي",
  "السياحة والفنادق", "العلوم الزراعية البيئية", "المصرية الصينية للتكنولوجيا",
  "تكنولوجيا الادارة ونظم المعلومات", "تكنولوجيا المصايد والاسماك",
  "تكنولوجيا صناعة السكر", "ثروة سمكية", "تشغيل المطاعم بنظام التعليم التبادلي",
  "تكنولوجي تمريض",
] as const;

const publicInstitutePatterns = [
  /^معهد فني صحي/u,
  /^فني صحي/u,
  /^فنى صحي/u,
  /^فني تمريض/u,
  /^فنى تمريض/u,
  /^المعهد الفني للتمريض/u,
  /^الفني (التجاري|الصناعي|لترميم|للخدمة|للفنادق)/u,
  /^المتوسط للخدمه الاجتماعية/u,
  /^ك\.ت\. فني/u,
  /^ش\.مطاعم فني/u,
  /^المجمع التكنولوجي المتكامل/u,
  /^مركز التكنولوجيا المتميز/u,
  /^الادارة والسكرتارية/u,
  /^سكرتاريه بكلية/u,
];

const privateOrHigherPatterns = [
  /معهد/u,
  /اكاديمي/u,
  /اكاديمية/u,
  /العالي/u,
  /العالى/u,
  /(?:^|\s)عالي(?:\s|$)/u,
  /تكنولوجي عالي/u,
  /جامعة خاصة/u,
  /جامعة اهلية/u,
  /الاهرام الكندية/u,
  /الجامعة المصرية اليابانية/u,
];

const explicitRenameRules: Array<{ pattern: RegExp; replacement: string; note: string }> = [
  { pattern: /العاصمة بحلوان/gu, replacement: "العاصمة", note: "جامعة العاصمة / حلوان سابقًا" },
  { pattern: /جنوب الوادي فرع الغردقة/gu, replacement: "الغردقة", note: "فرع الغردقة / جنوب الوادي" },
  { pattern: /حلوان/gu, replacement: "العاصمة", note: "جامعة العاصمة / حلوان سابقًا" },
  { pattern: /جنوب الوادي/gu, replacement: "قنا", note: "جامعة قنا / جنوب الوادي سابقًا" },
  { pattern: /مدينه السادات/gu, replacement: "السادات", note: "مدينة السادات / السادات" },
  { pattern: /مدينة السادات/gu, replacement: "السادات", note: "مدينة السادات / السادات" },
  { pattern: /بور سعيد/gu, replacement: "بورسعيد", note: "بور سعيد / بورسعيد" },
  { pattern: /رياضه/gu, replacement: "رياضة", note: "variant spelling" },
  { pattern: /الاقصر/gu, replacement: "الأقصر", note: "hamza variant" },
  { pattern: /الاسكندرية/gu, replacement: "الإسكندرية", note: "hamza variant" },
];

export function stableId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

export function normalizeOfficialLabel(label: string) {
  return normalizeArabicName(label)
    .replace(/ى/gu, "ي")
    .replace(/بنى/gu, "بني")
    .replace(/[–—]/gu, "-")
    .replace(/\s*[-/،,]\s*/gu, " ")
    .replace(/\s+و\s+/gu, " و")
    .replace(/\)\s*(بنين|بنات)/gu, ") $1")
    .replace(/\s+/gu, " ")
    .trim();
}

export function canonicalizeExplicitAliases(label: string) {
  let canonical = normalizeOfficialLabel(label);
  const notes: string[] = [];
  for (const rule of explicitRenameRules) {
    if (rule.pattern.test(canonical)) {
      canonical = canonical.replace(rule.pattern, rule.replacement);
      notes.push(rule.note);
    }
    rule.pattern.lastIndex = 0;
  }
  canonical = canonical
    .replace(/\bبالاسماعيلية\b/gu, "بالإسماعيلية")
    .replace(/المنوفية بشبين الكوم/gu, "المنوفية")
    .replace(/العاصمة العاصمة/gu, "العاصمة")
    .replace(/\s+/gu, " ")
    .trim();
  return { canonical, notes: [...new Set(notes)] };
}

export function classifyInstitution(label: string): InstitutionClass {
  const normalized = normalizeOfficialLabel(label);
  if (publicInstitutePatterns.some((pattern) => pattern.test(normalized))) {
    return "public_institute";
  }
  if (privateOrHigherPatterns.some((pattern) => pattern.test(normalized))) {
    return "private_or_higher_institute";
  }
  if (
    (/^كلية تكنولوجيا/u.test(normalized) && /التكنولوجية|شرق بورسعيد|طيبة/u.test(normalized)) ||
    /^الكلية التكنولوجية المصرية الالمانية/u.test(normalized) ||
    /^الكلية المصرية الكورية لتكنولوجيا الصناعة والطاقة/u.test(normalized)
  ) {
    return "public_technological_university";
  }
  if (publicFacultyPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return "public_university";
  }
  return "unknown";
}

export function sectorForLabel(label: string) {
  const normalized = normalizeOfficialLabel(label);
  const rules: Array<[RegExp, string]> = [
    [/^طب اسنان|طب وجراحة الفم/u, "dentistry"],
    [/^طب بيطري/u, "veterinary"],
    [/^طب/u, "medicine"],
    [/^صيدلة/u, "pharmacy"],
    [/^علاج طبيعي/u, "physiotherapy"],
    [/^(حاسبات|ذكاء اصطناعي|الذكاء الاصطناعي)/u, "computing"],
    [/^هندسة|تخطيط عمراني/u, "engineering"],
    [/^تمريض/u, "nursing"],
    [/^علوم صحية|^العلوم الصحية|^علوم التغذية/u, "health_sciences"],
    [/^علوم/u, "science"],
    [/^زراعة|^تكنولوجيا وتنمية.*علوم زراعية|^الثروة السمكية/u, "agriculture"],
    [/^الاستزراع المائي|^العلوم الزراعية البيئية|^تكنولوجيا المصايد|^ثروة سمكية/u, "agriculture"],
    [/^(اقتصاد|سياسة|الدراسات الاقتصادية)/u, "economics"],
    [/^السن/u, "languages"],
    [/^اعلام/u, "media"],
    [/^تجارة/u, "commerce"],
    [/^حقوق/u, "law"],
    [/^تربية|^التعليم الصناعي/u, "education"],
    [/^التكنولوجيا والتعليم الصناعي|^الاعاقة والتاهيل/u, "education"],
    [/^اداب|^دار العلوم/u, "arts"],
    [/^اثار/u, "archaeology"],
    [/^سياحة|^سياحه/u, "tourism"],
    [/^السياحة والفنادق|^تشغيل المطاعم/u, "tourism"],
    [/^خدمة اجتماعية/u, "social_work"],
    [/^فنون تطبيقية/u, "applied_arts"],
    [/^فنون جميلة/u, "fine_arts"],
    [/^اقتصاد منزلي/u, "home_economics"],
    [/^الملاحة وتكنولوجيا الفضاء/u, "space_navigation"],
    [/^كلية تكنولوجيا/u, "public_technology"],
    [/^الكلية التكنولوجية|^الكلية المصرية الكورية/u, "public_technology"],
    [/^المصرية الصينية للتكنولوجيا/u, "technology"],
    [/^تكنولوجيا الادارة ونظم المعلومات/u, "management_technology"],
    [/^تكنولوجيا صناعة السكر/u, "industrial_technology"],
  ];
  return rules.find(([pattern]) => pattern.test(normalized))?.[1] ?? "other";
}

const scienceOnlySectors = new Set([
  "medicine", "dentistry", "veterinary", "pharmacy", "physiotherapy", "nursing",
  "health_sciences", "agriculture",
]);
const mathOnlySectors = new Set(["engineering", "applied_arts"]);

export function scientificBranchesForLabel(label: string): Branch[] {
  const normalized = normalizeOfficialLabel(label);
  if (/\sرياض(?:ة|ه)(?:\s|$)/u.test(normalized)) return ["mathematics"];
  if (/\sعلوم(?:\s|$)/u.test(normalized) && /^(حاسبات|ذكاء|الذكاء|علوم |كلية تكنولوجيا)/u.test(normalized)) {
    return ["science"];
  }
  const sector = sectorForLabel(normalized);
  if (scienceOnlySectors.has(sector) || sector === "science" || sector === "computing") return ["science"];
  if (mathOnlySectors.has(sector)) return ["mathematics"];
  return ["science", "mathematics"];
}

export function requiresAptitudeTest(label: string) {
  const normalized = normalizeOfficialLabel(label);
  return /فنون جميلة|فنون تطبيقية|تربية رياضية|علوم الرياضة|تربية موسيقية|تربية فنية/u.test(normalized);
}

export function affiliationForLabel(label: string) {
  return /انتساب موجه/u.test(normalizeOfficialLabel(label))
    ? ("directed_affiliation" as const)
    : ("regular" as const);
}

export function findInstitution(label: string, institutionClass: InstitutionClass) {
  const normalized = normalizeOfficialLabel(label);
  if (normalized.includes("جنوب الوادي فرع الغردقة")) {
    const hurghada = institutionRules.find((rule) => rule.id === "hurghada")!;
    return { institution: hurghada, status: "resolved" as AliasResolutionStatus, candidates: [hurghada.id] };
  }
  const containsPattern = (pattern: string) => {
    const normalizedPattern = normalizeOfficialLabel(pattern);
    if (normalizedPattern.includes(" ")) return normalized.includes(normalizedPattern);
    return normalized.split(/\s+/u).includes(normalizedPattern);
  };
  const matches = institutionRules
    .map((rule) => ({
      rule,
      matchedPatterns: rule.patterns.map(normalizeOfficialLabel).filter((pattern) => containsPattern(pattern)),
    }))
    .filter((candidate) => candidate.matchedPatterns.length > 0);
  const classMatches = matches.filter((candidate) => candidate.rule.institutionClass === institutionClass);
  const selectedPool = classMatches.length ? classMatches : matches;
  const undominated = selectedPool.filter((candidate) =>
    !selectedPool.some((other) =>
      other.rule.id !== candidate.rule.id &&
      candidate.matchedPatterns.every((candidatePattern) =>
        other.matchedPatterns.some((otherPattern) =>
          otherPattern.length > candidatePattern.length && otherPattern.includes(candidatePattern),
        ),
      ),
    ),
  );
  if (!undominated.length) return { institution: null, status: "ambiguous" as AliasResolutionStatus, candidates: [] as string[] };
  if (undominated.length !== 1) {
    return { institution: null, status: "ambiguous" as AliasResolutionStatus, candidates: undominated.map((row) => row.rule.id) };
  }
  return { institution: undominated[0].rule, status: "resolved" as AliasResolutionStatus, candidates: [undominated[0].rule.id] };
}

export function inferGovernorate(label: string, institutionId?: string | null) {
  const institution = institutionRules.find((row) => row.id === institutionId);
  if (institution?.governorate) return institution.governorate;
  const normalized = normalizeOfficialLabel(label);
  return egyptianGovernorates.find((item) => normalized.includes(normalizeOfficialLabel(item))) ?? null;
}

export function optionIdentity(label: string, branch: Branch, institutionId: string) {
  const { canonical, notes } = canonicalizeExplicitAliases(label);
  const normalizedBranch = canonical
    .replace(/\s+رياض(?:ة|ه)(?=\s|$)/gu, " رياضة")
    .replace(/\s+/gu, " ")
    .trim();
  const physicalName = normalizedBranch
    .replace(/\s+انتساب موجه(?=\s|$)/gu, "")
    .replace(/\s+(علوم|رياضة)(?=\s|$)/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const affiliation = affiliationForLabel(normalizedBranch);
  // Official lists may publish the same option once with an explicit scientific
  // suffix and once without it. Admission identity is the physical option,
  // branch, and affiliation; the official spellings remain aliases/observations.
  const optionId = stableId("option", `${institutionId}|${branch}|${affiliation}|${physicalName}`);
  return {
    optionId,
    physicalFacultyId: stableId("faculty", `${institutionId}|${physicalName}`),
    canonicalLabel: normalizedBranch,
    physicalName,
    notes,
  };
}

export function isPublicCoreClass(value: InstitutionClass): value is PublicInstitutionClass {
  return value === "public_university" || value === "public_technological_university";
}

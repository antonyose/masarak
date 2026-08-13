import type { Branch } from "@/lib/grade-scales";

export type DisciplineId =
  | "all"
  | "health"
  | "computing"
  | "engineering"
  | "science"
  | "languages"
  | "economics"
  | "humanities";

export interface DisciplineGroup {
  id: DisciplineId;
  label: string;
  shortLabel: string;
  icon: string;
}

export const DISCIPLINE_GROUPS: Record<Exclude<DisciplineId, "all">, DisciplineGroup> = {
  health: {
    id: "health",
    label: "القطاع الطبي والتمريض والصحي",
    shortLabel: "تمريض وصحي",
    icon: "🩺",
  },
  computing: {
    id: "computing",
    label: "الحاسبات والذكاء الاصطناعي",
    shortLabel: "حاسبات وذكاء اصطناعي",
    icon: "💻",
  },
  engineering: {
    id: "engineering",
    label: "الهندسة والفنون والتكنولوجيا",
    shortLabel: "هندسة وفنون وتكنولوجيا",
    icon: "⚙️",
  },
  science: {
    id: "science",
    label: "العلوم والتكنولوجيا والزراعة",
    shortLabel: "علوم وزراعة",
    icon: "🧪",
  },
  languages: {
    id: "languages",
    label: "الألسن واللغات والإعلام والآثار",
    shortLabel: "ألسن ولغات وإعلام",
    icon: "🌍",
  },
  economics: {
    id: "economics",
    label: "الاقتصاد والعلوم السياسية والتجارة",
    shortLabel: "اقتصاد وتجارة",
    icon: "📊",
  },
  humanities: {
    id: "humanities",
    label: "التربية والآداب والعلوم الإنسانية",
    shortLabel: "تربية وآداب وإنسانيات",
    icon: "📚",
  },
};

export function getDisciplineGroup(officialName: string, sector?: string): DisciplineGroup {
  const name = officialName.trim();

  // 1. Health & Nursing
  if (
    /تمريض|فني صحي|علوم صحية|تغذية|علاج طبيعي|صيدلة|طب بيطري|طب اسنان|طب وجراحة|طب /u.test(name) ||
    sector === "nursing" ||
    sector === "health_sciences" ||
    sector === "medicine" ||
    sector === "dentistry" ||
    sector === "pharmacy" ||
    sector === "physiotherapy" ||
    sector === "veterinary"
  ) {
    return DISCIPLINE_GROUPS.health;
  }

  // 2. Computing & AI
  if (
    /حاسبات|ذكاء اصطناعي|الذكاء الاصطناعي|تكنولوجيا المعلومات|نظم معلومات/u.test(name) ||
    sector === "computing"
  ) {
    return DISCIPLINE_GROUPS.computing;
  }

  // 3. Economics, Politics & Commerce
  if (
    /اقتصاد|علوم سياسية|سياسة|الدراسات الاقتصادية|تجارة|ادارة الاعمال|إدارة الأعمال|تكنولوجيا الادارة/u.test(name) ||
    sector === "economics" ||
    sector === "commerce" ||
    sector === "management_technology"
  ) {
    return DISCIPLINE_GROUPS.economics;
  }

  // 4. Languages, Media & Archaeology
  if (
    /السن|ألسن|لغات|اعلام|إعلام|اثار|آثار/u.test(name) ||
    sector === "languages" ||
    sector === "media" ||
    sector === "archaeology"
  ) {
    return DISCIPLINE_GROUPS.languages;
  }

  // 5. Engineering, Applied Arts & Tech Universities
  if (
    /هندسة|فنون تطبيقية|فنون جميلة|تخطيط عمراني|الملاحة وتكنولوجيا الفضاء|تكنولوجية|الكلية التكنولوجية|المصرية الصينية|صناعة السكر/u.test(name) ||
    sector === "engineering" ||
    sector === "applied_arts" ||
    sector === "fine_arts" ||
    sector === "space_navigation" ||
    sector === "public_technology" ||
    sector === "technology" ||
    sector === "industrial_technology"
  ) {
    return DISCIPLINE_GROUPS.engineering;
  }

  // 6. Science, Agriculture & Aquatic Sciences
  if (
    /علوم |علوم$|زراعة|استزراع مائي|ثروة سمكية|علوم زراعية/u.test(name) ||
    sector === "science" ||
    sector === "agriculture"
  ) {
    return DISCIPLINE_GROUPS.science;
  }

  // 7. Humanities, Education, Arts, Law & Social Work
  return DISCIPLINE_GROUPS.humanities;
}

export interface ReportItemSummary {
  id: string;
  officialNameArabic: string;
  fit: "green" | "yellow" | "orange" | "red" | string;
  fitLabel?: string;
  proximityLabel?: string;
  predictedCutoffPercentage?: number;
  expectedRange?: [number, number];
}

export interface ReportInsights {
  topLocalOptions: ReportItemSummary[];
  topAmbitiousOptions: ReportItemSummary[];
  dominantSectors: DisciplineGroup[];
  hasNearbyGuaranteed: boolean;
  strategicAdvice: string;
}

export function extractReportInsights({
  items,
  governorate,
  isForecast = false,
}: {
  items: ReportItemSummary[];
  studentName?: string;
  score?: number | null;
  percentage?: number | null;
  branch?: Branch | "unknown";
  governorate?: string | null;
  isForecast?: boolean;
}): ReportInsights {
  const localOptions = items.filter(
    (item) =>
      item.proximityLabel === "في محافظتك" ||
      item.proximityLabel === "قريبة منك" ||
      (item.proximityLabel && item.proximityLabel !== "محافظة أخرى" && item.proximityLabel !== "other"),
  );

  const guaranteedOrGood = (item: ReportItemSummary) =>
    item.fit === "green" || item.fit === "yellow" || item.fit === "safe" || item.fit === "target";

  const topLocal = localOptions
    .filter(guaranteedOrGood)
    .slice(0, 3);

  const topAmbitious = items
    .filter((item) => item.fit === "orange" || item.fit === "reach")
    .slice(0, 2);

  // Identify dominant sectors
  const sectorCount = new Map<DisciplineId, number>();
  for (const item of items) {
    const group = getDisciplineGroup(item.officialNameArabic);
    sectorCount.set(group.id, (sectorCount.get(group.id) ?? 0) + 1);
  }

  const dominantSectors = [...sectorCount.entries()]
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 3)
    .map(([id]) => DISCIPLINE_GROUPS[id as Exclude<DisciplineId, "all">])
    .filter(Boolean);

  const hasNearbyGuaranteed = topLocal.length > 0;

  let strategicAdvice = "رتب رغباتك باختيار كليات محافظتك ونطاقك القريب أولاً لضمان أفضل كلية وتفادي الاغتراب.";
  if (hasNearbyGuaranteed && governorate) {
    strategicAdvice = isForecast
      ? `لديك توقعات أقرب في كليات داخل أو بالقرب من محافظة ${governorate}؛ تابع إعلان المرحلة الثالثة قبل التقديم.`
      : `لديك فرص قوية ومؤكدة في كليات داخل أو بالقرب من محافظة ${governorate}؛ ابدأ بها في الترتيب.`;
  } else if (!hasNearbyGuaranteed) {
    strategicAdvice = isForecast
      ? "دي توقعات إرشادية فقط؛ راجع قائمة المرحلة الثالثة الرسمية عند صدورها قبل ترتيب الرغبات."
      : "ننصحك بالتقديم في كليات المحافظات القريبة مع الاستفادة من قواعد تقليل الاغتراب بعد إعلان النتيجة.";
  }

  return {
    topLocalOptions: topLocal,
    topAmbitiousOptions: topAmbitious,
    dominantSectors,
    hasNearbyGuaranteed,
    strategicAdvice,
  };
}

export interface TansikBlueprintStage {
  bracketTitle: string;
  rangeText: string;
  description: string;
  badgeClass: string;
  sampleColleges: string[];
}

export function buildTansikBlueprint(items: ReportItemSummary[]): TansikBlueprintStage[] {
  const ambitious = items.filter((item) => item.fit === "orange" || item.fit === "reach");
  const closest = items.filter((item) => item.fit === "green" || item.fit === "yellow" || item.fit === "safe" || item.fit === "target");

  const ambitiousNames = ambitious.slice(0, 4).map((i) => i.officialNameArabic);
  const closestNames = closest.slice(0, 5).map((i) => i.officialNameArabic);
  const safetyNames = closest.slice(5, 9).map((i) => i.officialNameArabic);

  return [
    {
      bracketTitle: "الرغبات 1 إلى 15 (كليات الطموح والمنافسة)",
      rangeText: "رغبات 1 – 15",
      description: "ضع الكليات ذات الحد الأدنى الأعلى التي تتمنى الالتحاق بها دون خوف من ضياع فرصتك.",
      badgeClass: "blueprint-badge-ambitious",
      sampleColleges: ambitiousNames.length ? ambitiousNames : ["الكليات الطموحة الأعلى في نطاقك"],
    },
    {
      bracketTitle: "الرغبات 16 إلى 50 (الفرص الحقيقية والمضمونة)",
      rangeText: "رغبات 16 – 50",
      description: "الكليات الأكثر ملاءمة لمجموعك في محافظتك ونطاقك الإقليمي (أ) و (ب).",
      badgeClass: "blueprint-badge-closest",
      sampleColleges: closestNames.length ? closestNames : ["الكليات الأقرب لمجموعك ومحافظتك"],
    },
    {
      bracketTitle: "الرغبات 51 إلى 75 (شبكة الأمان وتفادي الاستنفاد)",
      rangeText: "رغبات 51 – 75",
      description: "كليات ومعاهد حكومية مضمونة تماماً لضمان عدم استنفاد بطاقة الرغبات.",
      badgeClass: "blueprint-badge-safety",
      sampleColleges: safetyNames.length ? safetyNames : ["الكليات والبدائل المضمونة لشعبتك"],
    },
  ];
}

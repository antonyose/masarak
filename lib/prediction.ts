import type { Branch } from "@/lib/grade-scales";
import {
  getProximityTier,
  proximityLabels,
  proximityRank,
  type ProximityTier,
} from "@/lib/governorates";

export type PredictionCategory =
  | "reach"
  | "target"
  | "safe"
  | "unlikely"
  | "insufficient_data";

export type FacultyPrediction = {
  id: string;
  slug: string;
  facultyName: string;
  universityName: string;
  governorate: string;
  sector: string;
  branch: Branch;
  expectedRange: [number, number];
  historicalCutoffs: Record<2023 | 2024 | 2025, number | null>;
  official2025Score: number;
  officialName: string;
  sourceUrl: string;
  expectedRankPercentile: number;
  volatility: number;
  category: PredictionCategory;
  confidence: "مرتفعة" | "متوسطة" | "منخفضة";
  difference: number;
  explanation: string;
  proximityTier: ProximityTier;
  proximityLabel: string;
};

type FacultySeed = Omit<
  FacultyPrediction,
  | "category"
  | "confidence"
  | "difference"
  | "explanation"
  | "proximityTier"
  | "proximityLabel"
>;

type CatalogItem = {
  id: string;
  facultyName: string;
  universityName: string;
  governorate: string;
  sector: string;
  branch: Branch;
  official2025Score: number;
  officialName?: string;
};

const SCIENCE_SOURCE =
  "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2025.htm";
const LITERARY_SOURCE =
  "https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2025.htm";

function roundPercentage(value: number) {
  return Math.round(value * 100) / 100;
}

function slugifyId(id: string) {
  return id.replaceAll("_", "-");
}

function createOfficialSeed(item: CatalogItem): FacultySeed {
  const cutoff = roundPercentage((item.official2025Score / 320) * 100);
  const expectedRange: [number, number] = [
    roundPercentage(Math.max(0, cutoff - 0.7)),
    roundPercentage(Math.min(100, cutoff + 0.55)),
  ];
  const expectedRankPercentile = estimateRankPercentile(cutoff);

  return {
    ...item,
    slug: slugifyId(item.id),
    officialName:
      item.officialName ??
      `${item.facultyName.replace(/^كلية /, "")} ${item.universityName.replace(/^جامعة /, "")}`,
    expectedRange,
    historicalCutoffs: { 2023: null, 2024: null, 2025: cutoff },
    sourceUrl:
      item.branch === "literary" ? LITERARY_SOURCE : SCIENCE_SOURCE,
    expectedRankPercentile,
    volatility: Math.max(
      0.006,
      estimateRankPercentile(Math.max(0, cutoff - 1.5)) -
        expectedRankPercentile,
    ),
  };
}

const catalog: CatalogItem[] = [
  // علمي علوم: الكليات الطبية الأعلى طلبًا ثم البدائل الصحية والعلمية.
  {
    id: "medicine_sohag",
    facultyName: "كلية الطب",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 300.5,
    officialName: "طب سوهاج",
  },
  {
    id: "medicine_assiut",
    facultyName: "كلية الطب",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 298.5,
    officialName: "طب أسيوط",
  },
  {
    id: "medicine_south_valley",
    facultyName: "كلية الطب",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 299,
    officialName: "طب جنوب الوادي",
  },
  {
    id: "medicine_minya",
    facultyName: "كلية الطب",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 298.5,
    officialName: "طب المنيا",
  },
  {
    id: "dentistry_sohag",
    facultyName: "كلية طب الفم والأسنان",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 297.5,
    officialName: "طب وجراحة الفم والأسنان سوهاج",
  },
  {
    id: "dentistry_assiut",
    facultyName: "كلية طب الأسنان",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 297,
    officialName: "طب أسنان أسيوط",
  },
  {
    id: "dentistry_south_valley",
    facultyName: "كلية طب الأسنان",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 297.5,
    officialName: "طب أسنان جنوب الوادي",
  },
  {
    id: "dentistry_minya",
    facultyName: "كلية طب الأسنان",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 297,
    officialName: "طب أسنان المنيا",
  },
  {
    id: "physiotherapy_south_valley",
    facultyName: "كلية العلاج الطبيعي",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "العلاج الطبيعي",
    branch: "science",
    official2025Score: 295.5,
    officialName: "علاج طبيعي جنوب الوادي",
  },
  {
    id: "physiotherapy_beni_suef",
    facultyName: "كلية العلاج الطبيعي",
    universityName: "جامعة بني سويف",
    governorate: "بني سويف",
    sector: "العلاج الطبيعي",
    branch: "science",
    official2025Score: 294.5,
    officialName: "علاج طبيعي بني سويف",
  },
  {
    id: "pharmacy_sohag",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 297,
    officialName: "صيدلة سوهاج",
  },
  {
    id: "pharmacy_assiut",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 295.5,
    officialName: "صيدلة أسيوط",
  },
  {
    id: "pharmacy_south_valley",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 296,
    officialName: "صيدلة جنوب الوادي",
  },
  {
    id: "pharmacy_minya",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 295,
    officialName: "صيدلة المنيا",
  },
  {
    id: "computers_science_sohag",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 293.5,
    officialName: "حاسبات ومعلومات سوهاج علوم",
  },
  {
    id: "computers_science_assiut",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 290.5,
    officialName: "حاسبات ومعلومات أسيوط علوم",
  },
  {
    id: "computers_science_qena",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 292.5,
    officialName: "حاسبات ومعلومات قنا علوم",
  },
  {
    id: "computers_science_luxor",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة الأقصر",
    governorate: "الأقصر",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 290,
    officialName: "حاسبات ومعلومات الأقصر علوم",
  },
  {
    id: "computers_science_minya",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 291,
    officialName: "حاسبات ومعلومات المنيا علوم",
  },
  {
    id: "veterinary_sohag",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 290.5,
    officialName: "طب بيطري سوهاج",
  },
  {
    id: "veterinary_assiut",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 287.5,
    officialName: "طب بيطري أسيوط",
  },
  {
    id: "veterinary_south_valley",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 288,
    officialName: "طب بيطري جنوب الوادي",
  },
  {
    id: "veterinary_minya",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 285.5,
    officialName: "طب بيطري المنيا",
  },
  {
    id: "veterinary_aswan",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة أسوان",
    governorate: "أسوان",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 282.5,
    officialName: "طب بيطري أسوان",
  },
  {
    id: "veterinary_new_valley",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة الوادي الجديد",
    governorate: "الوادي الجديد",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 278.5,
    officialName: "طب بيطري الوادي الجديد",
  },
  {
    id: "nursing_sohag",
    facultyName: "كلية التمريض",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "التمريض",
    branch: "science",
    official2025Score: 285.5,
    officialName: "تمريض سوهاج",
  },
  {
    id: "nursing_assiut",
    facultyName: "كلية التمريض",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "التمريض",
    branch: "science",
    official2025Score: 280,
    officialName: "تمريض أسيوط",
  },
  {
    id: "nursing_south_valley",
    facultyName: "كلية التمريض",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "التمريض",
    branch: "science",
    official2025Score: 279.5,
    officialName: "تمريض جنوب الوادي",
  },
  {
    id: "nursing_minya",
    facultyName: "كلية التمريض",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "التمريض",
    branch: "science",
    official2025Score: 275,
    officialName: "تمريض المنيا",
  },
  {
    id: "nursing_aswan",
    facultyName: "كلية التمريض",
    universityName: "جامعة أسوان",
    governorate: "أسوان",
    sector: "التمريض",
    branch: "science",
    official2025Score: 275.5,
    officialName: "تمريض أسوان",
  },
  {
    id: "nursing_new_valley",
    facultyName: "كلية التمريض",
    universityName: "جامعة الوادي الجديد",
    governorate: "الوادي الجديد",
    sector: "التمريض",
    branch: "science",
    official2025Score: 274,
    officialName: "تمريض الوادي الجديد",
  },
  {
    id: "technical_health_sohag",
    facultyName: "المعهد الفني الصحي",
    universityName: "سوهاج",
    governorate: "سوهاج",
    sector: "العلوم الصحية التطبيقية",
    branch: "science",
    official2025Score: 286,
    officialName: "معهد فني صحى سوهاج",
  },
  {
    id: "technical_health_assiut",
    facultyName: "المعهد الفني الصحي",
    universityName: "أسيوط",
    governorate: "أسيوط",
    sector: "العلوم الصحية التطبيقية",
    branch: "science",
    official2025Score: 284,
    officialName: "معهد فني صحى اسيوط",
  },
  {
    id: "science_sohag",
    facultyName: "كلية العلوم",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 277.5,
    officialName: "علوم سوهاج",
  },
  {
    id: "science_assiut",
    facultyName: "كلية العلوم",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 262.5,
    officialName: "علوم أسيوط",
  },
  {
    id: "science_south_valley",
    facultyName: "كلية العلوم",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 263.5,
    officialName: "علوم جنوب الوادي",
  },
  {
    id: "science_minya",
    facultyName: "كلية العلوم",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 254.5,
    officialName: "علوم المنيا",
  },
  {
    id: "science_aswan",
    facultyName: "كلية العلوم",
    universityName: "جامعة أسوان",
    governorate: "أسوان",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 252.5,
    officialName: "علوم أسوان",
  },
  {
    id: "science_new_valley",
    facultyName: "كلية العلوم",
    universityName: "جامعة الوادي الجديد",
    governorate: "الوادي الجديد",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 250.5,
    officialName: "علوم الوادي الجديد",
  },
  {
    id: "agriculture_sohag",
    facultyName: "كلية الزراعة",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 209.5,
    officialName: "زراعة سوهاج",
  },
  {
    id: "agriculture_assiut",
    facultyName: "كلية الزراعة",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 207.5,
    officialName: "زراعة أسيوط",
  },
  {
    id: "agriculture_south_valley",
    facultyName: "كلية الزراعة",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 209.5,
    officialName: "زراعة جنوب الوادي",
  },
  {
    id: "agriculture_minya",
    facultyName: "كلية الزراعة",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 209.5,
    officialName: "زراعة المنيا",
  },
  {
    id: "agriculture_aswan",
    facultyName: "كلية الزراعة والموارد الطبيعية",
    universityName: "جامعة أسوان",
    governorate: "أسوان",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 224.5,
    officialName: "زراعة و موارد طبيعية أسوان",
  },
  {
    id: "medicine_alexandria",
    facultyName: "كلية الطب",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 302.5,
    officialName: "طب الإسكندرية",
  },
  {
    id: "dentistry_alexandria",
    facultyName: "كلية طب الأسنان",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 297,
    officialName: "طب أسنان الإسكندرية",
  },
  {
    id: "pharmacy_alexandria",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 294.5,
    officialName: "صيدلة الإسكندرية",
  },
  {
    id: "computers_science_alexandria",
    facultyName: "كلية الحاسبات وعلوم البيانات",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 285.5,
    officialName: "حاسبات و علوم البيانات الإسكندرية علوم",
  },
  {
    id: "veterinary_alexandria",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 282,
    officialName: "طب بيطري الإسكندرية",
  },
  {
    id: "nursing_alexandria",
    facultyName: "كلية التمريض",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "التمريض",
    branch: "science",
    official2025Score: 275,
    officialName: "تمريض الإسكندرية",
  },
  {
    id: "science_alexandria",
    facultyName: "كلية العلوم",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 261,
    officialName: "علوم الإسكندرية",
  },
  {
    id: "agriculture_alexandria",
    facultyName: "كلية الزراعة",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 224.5,
    officialName: "زراعة الإسكندرية",
  },
  {
    id: "medicine_cairo",
    facultyName: "كلية الطب",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 303.5,
    officialName: "طب القاهرة",
  },
  {
    id: "dentistry_cairo",
    facultyName: "كلية طب الأسنان",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 297,
    officialName: "طب أسنان القاهرة",
  },
  {
    id: "physiotherapy_cairo",
    facultyName: "كلية العلاج الطبيعي",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "العلاج الطبيعي",
    branch: "science",
    official2025Score: 294.5,
    officialName: "علاج طبيعي القاهرة",
  },
  {
    id: "pharmacy_cairo",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 294.5,
    officialName: "صيدلة القاهرة",
  },
  {
    id: "computers_science_cairo",
    facultyName: "كلية الحاسبات والذكاء الاصطناعي",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 288,
    officialName: "حاسبات و ذكاء إصطناعي القاهرة علوم",
  },
  {
    id: "nursing_cairo",
    facultyName: "كلية التمريض",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "التمريض",
    branch: "science",
    official2025Score: 276.5,
    officialName: "تمريض القاهرة",
  },
  {
    id: "science_cairo",
    facultyName: "كلية العلوم",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 259.5,
    officialName: "علوم القاهرة",
  },
  {
    id: "agriculture_cairo",
    facultyName: "كلية الزراعة",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 228,
    officialName: "زراعة القاهرة",
  },
  {
    id: "medicine_mansoura",
    facultyName: "كلية الطب",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "الطب البشري",
    branch: "science",
    official2025Score: 303.5,
    officialName: "طب المنصورة",
  },
  {
    id: "dentistry_mansoura",
    facultyName: "كلية طب الأسنان",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "طب الأسنان",
    branch: "science",
    official2025Score: 298,
    officialName: "طب أسنان المنصورة",
  },
  {
    id: "pharmacy_mansoura",
    facultyName: "كلية الصيدلة",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "الصيدلة",
    branch: "science",
    official2025Score: 296,
    officialName: "صيدلة المنصورة",
  },
  {
    id: "computers_science_mansoura",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "الحاسبات والمعلومات",
    branch: "science",
    official2025Score: 289.5,
    officialName: "حاسبات ومعلومات المنصورة علوم",
  },
  {
    id: "veterinary_mansoura",
    facultyName: "كلية الطب البيطري",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "الطب البيطري",
    branch: "science",
    official2025Score: 288,
    officialName: "طب بيطري المنصورة",
  },
  {
    id: "nursing_mansoura",
    facultyName: "كلية التمريض",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "التمريض",
    branch: "science",
    official2025Score: 286.5,
    officialName: "تمريض المنصورة",
  },
  {
    id: "science_mansoura",
    facultyName: "كلية العلوم",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "العلوم الأساسية",
    branch: "science",
    official2025Score: 263,
    officialName: "علوم المنصورة",
  },
  {
    id: "agriculture_mansoura",
    facultyName: "كلية الزراعة",
    universityName: "جامعة المنصورة",
    governorate: "الدقهلية",
    sector: "العلوم الزراعية",
    branch: "science",
    official2025Score: 233.5,
    officialName: "زراعة المنصورة",
  },

  // علمي رياضة: هندسة، حاسبات، ثم بدائل علمية قريبة.
  {
    id: "engineering_sohag",
    facultyName: "كلية الهندسة",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 293,
    officialName: "هندسة سوهاج",
  },
  {
    id: "engineering_assiut",
    facultyName: "كلية الهندسة",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 289,
    officialName: "هندسة أسيوط",
  },
  {
    id: "engineering_south_valley",
    facultyName: "كلية الهندسة",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 293.5,
    officialName: "هندسة جنوب الوادي",
  },
  {
    id: "engineering_minya",
    facultyName: "كلية الهندسة",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 288,
    officialName: "هندسة المنيا",
  },
  {
    id: "engineering_beni_suef",
    facultyName: "كلية الهندسة",
    universityName: "جامعة بني سويف",
    governorate: "بني سويف",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 288.5,
    officialName: "هندسة بني سويف",
  },
  {
    id: "engineering_cairo",
    facultyName: "كلية الهندسة",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 296,
    officialName: "هندسة القاهرة",
  },
  {
    id: "engineering_alexandria",
    facultyName: "كلية الهندسة",
    universityName: "جامعة الإسكندرية",
    governorate: "الإسكندرية",
    sector: "الهندسة",
    branch: "mathematics",
    official2025Score: 290.5,
    officialName: "هندسة الإسكندرية",
  },
  {
    id: "computers_math_sohag",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الحاسبات والمعلومات",
    branch: "mathematics",
    official2025Score: 278.5,
    officialName: "حاسبات ومعلومات سوهاج رياضة",
  },
  {
    id: "computers_math_assiut",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الحاسبات والمعلومات",
    branch: "mathematics",
    official2025Score: 270,
    officialName: "حاسبات ومعلومات أسيوط رياضة",
  },
  {
    id: "computers_math_qena",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الحاسبات والمعلومات",
    branch: "mathematics",
    official2025Score: 270.5,
    officialName: "حاسبات ومعلومات قنا رياضة",
  },
  {
    id: "computers_math_luxor",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة الأقصر",
    governorate: "الأقصر",
    sector: "الحاسبات والمعلومات",
    branch: "mathematics",
    official2025Score: 269.5,
    officialName: "حاسبات ومعلومات الأقصر رياضة",
  },
  {
    id: "computers_math_minya",
    facultyName: "كلية الحاسبات والمعلومات",
    universityName: "جامعة المنيا",
    governorate: "المنيا",
    sector: "الحاسبات والمعلومات",
    branch: "mathematics",
    official2025Score: 270.5,
    officialName: "حاسبات ومعلومات المنيا رياضة",
  },
  {
    id: "science_math_sohag",
    facultyName: "كلية العلوم",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "العلوم الأساسية",
    branch: "mathematics",
    official2025Score: 216.5,
    officialName: "علوم سوهاج رياضة",
  },
  {
    id: "science_math_assiut",
    facultyName: "كلية العلوم",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "العلوم الأساسية",
    branch: "mathematics",
    official2025Score: 220,
    officialName: "علوم أسيوط رياضة",
  },
  {
    id: "science_math_south_valley",
    facultyName: "كلية العلوم",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "العلوم الأساسية",
    branch: "mathematics",
    official2025Score: 213.5,
    officialName: "علوم جنوب الوادي رياضة",
  },

  // أدبي: أهم المسارات ثم بدائل صعيد مصر الأقرب.
  {
    id: "economics_cairo",
    facultyName: "كلية الاقتصاد والعلوم السياسية",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "الاقتصاد والعلوم السياسية",
    branch: "literary",
    official2025Score: 299.5,
    officialName: "اقتصاد و علوم سياسية القاهرة",
  },
  {
    id: "alsun_ain_shams",
    facultyName: "كلية الألسن",
    universityName: "جامعة عين شمس",
    governorate: "القاهرة",
    sector: "اللغات",
    branch: "literary",
    official2025Score: 292,
    officialName: "ألسن عين شمس",
  },
  {
    id: "media_cairo",
    facultyName: "كلية الإعلام",
    universityName: "جامعة القاهرة",
    governorate: "الجيزة",
    sector: "الإعلام",
    branch: "literary",
    official2025Score: 288.5,
    officialName: "إعلام القاهرة",
  },
  {
    id: "alsun_sohag",
    facultyName: "كلية الألسن",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "اللغات",
    branch: "literary",
    official2025Score: 282,
    officialName: "ألسن سوهاج",
  },
  {
    id: "media_south_valley",
    facultyName: "كلية الإعلام وتكنولوجيا الاتصال",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الإعلام",
    branch: "literary",
    official2025Score: 277.5,
    officialName: "إعلام جنوب الوادي",
  },
  {
    id: "law_sohag",
    facultyName: "كلية الحقوق",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الدراسات القانونية",
    branch: "literary",
    official2025Score: 265.5,
    officialName: "حقوق سوهاج",
  },
  {
    id: "archaeology_sohag",
    facultyName: "كلية الآثار",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الآثار والتراث",
    branch: "literary",
    official2025Score: 263.5,
    officialName: "آثار سوهاج",
  },
  {
    id: "commerce_sohag",
    facultyName: "كلية التجارة",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "الدراسات التجارية",
    branch: "literary",
    official2025Score: 233.5,
    officialName: "تجارة سوهاج",
  },
  {
    id: "education_sohag",
    facultyName: "كلية التربية",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "التربية والتعليم",
    branch: "literary",
    official2025Score: 234.5,
    officialName: "تربية سوهاج",
  },
  {
    id: "arts_sohag",
    facultyName: "كلية الآداب",
    universityName: "جامعة سوهاج",
    governorate: "سوهاج",
    sector: "العلوم الإنسانية",
    branch: "literary",
    official2025Score: 204,
    officialName: "آداب سوهاج",
  },
  {
    id: "commerce_assiut",
    facultyName: "كلية التجارة",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الدراسات التجارية",
    branch: "literary",
    official2025Score: 235,
    officialName: "تجارة أسيوط",
  },
  {
    id: "education_assiut",
    facultyName: "كلية التربية",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "التربية والتعليم",
    branch: "literary",
    official2025Score: 235.5,
    officialName: "تربية أسيوط",
  },
  {
    id: "law_assiut",
    facultyName: "كلية الحقوق",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "الدراسات القانونية",
    branch: "literary",
    official2025Score: 212,
    officialName: "حقوق أسيوط",
  },
  {
    id: "arts_assiut",
    facultyName: "كلية الآداب",
    universityName: "جامعة أسيوط",
    governorate: "أسيوط",
    sector: "العلوم الإنسانية",
    branch: "literary",
    official2025Score: 213.5,
    officialName: "آداب أسيوط",
  },
  {
    id: "commerce_south_valley",
    facultyName: "كلية التجارة",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الدراسات التجارية",
    branch: "literary",
    official2025Score: 251.5,
    officialName: "تجارة جنوب الوادي",
  },
  {
    id: "law_south_valley",
    facultyName: "كلية الحقوق",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "الدراسات القانونية",
    branch: "literary",
    official2025Score: 264,
    officialName: "حقوق جنوب الوادي",
  },
  {
    id: "arts_south_valley",
    facultyName: "كلية الآداب",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "العلوم الإنسانية",
    branch: "literary",
    official2025Score: 205,
    officialName: "آداب جنوب الوادي",
  },
  {
    id: "education_south_valley",
    facultyName: "كلية التربية",
    universityName: "جامعة جنوب الوادي",
    governorate: "قنا",
    sector: "التربية والتعليم",
    branch: "literary",
    official2025Score: 232.5,
    officialName: "تربية جنوب الوادي",
  },
];

export const facultySeeds: FacultySeed[] = catalog.map(createOfficialSeed);

export function estimateRankPercentile(percentage: number): number {
  const bounded = Math.min(100, Math.max(0, percentage));
  return Math.min(0.999, Math.pow((100 - bounded) / 47, 2.05));
}

export function classifyPrediction(
  studentRankPercentile: number,
  expectedRankPercentile: number,
  volatility: number,
): PredictionCategory {
  const optimisticThreshold = expectedRankPercentile + volatility;
  const conservativeThreshold = Math.max(
    0,
    expectedRankPercentile - volatility,
  );

  if (studentRankPercentile <= conservativeThreshold * 0.86) return "safe";
  if (studentRankPercentile <= expectedRankPercentile) return "target";
  if (studentRankPercentile <= optimisticThreshold) return "reach";
  return "unlikely";
}

export function classifyExpectedRange(
  percentage: number,
  expectedRange: [number, number],
): PredictionCategory {
  const [optimistic, conservative] = expectedRange;
  if (percentage >= conservative + 0.35) return "safe";
  if (percentage >= optimistic) return "target";
  if (percentage >= optimistic - 1.5) return "reach";
  return "unlikely";
}

const categoryExplanation: Record<PredictionCategory, string> = {
  safe:
    "مجموعك أعلى بوضوح من النطاق الاسترشادي المبني على تنسيق 2025، لذلك تظهر ضمن الخيارات الأكثر اطمئنانًا.",
  target:
    "مجموعك داخل النطاق الاسترشادي القريب من حد 2025، لذلك تظهر ضمن أقرب الخيارات الواقعية.",
  reach:
    "الفارق محدود وقد تدخل في نطاقك إذا انخفض الحد، لذلك احتفظ بها كاختيار طموح بعد الخيارات الأقرب.",
  unlikely:
    "الفارق الحالي كبير مقارنة بمرجع 2025، لذلك أخفيناها من الترشيحات الأساسية ووضعناها ضمن الخيارات البعيدة.",
  insufficient_data:
    "لا توجد بيانات تاريخية كافية لوضع هذه الكلية داخل نطاق موثوق.",
};

const categoryOrder: Record<PredictionCategory, number> = {
  target: 0,
  safe: 1,
  reach: 2,
  unlikely: 3,
  insufficient_data: 4,
};

export function selectRecommendedFaculties(
  predictions: FacultyPrediction[],
  limit = 5,
): FacultyPrediction[] {
  const viable = predictions.filter(
    (faculty) =>
      faculty.category === "target" ||
      faculty.category === "safe" ||
      faculty.category === "reach",
  );
  const selected: FacultyPrediction[] = [];

  const addFrom = (
    items: FacultyPrediction[],
    count: number,
  ) => {
    for (const faculty of items) {
      if (selected.length >= limit || count <= 0) break;
      if (selected.some((item) => item.id === faculty.id)) continue;
      selected.push(faculty);
      count -= 1;
    }
  };

  const strong = (tier: ProximityTier) =>
    viable.filter(
      (faculty) =>
        faculty.proximityTier === tier && faculty.category !== "reach",
    );
  const ambitious = (tier: ProximityTier) =>
    viable.filter(
      (faculty) =>
        faculty.proximityTier === tier && faculty.category === "reach",
    );
  const hasSelectedGovernorate = viable.some(
    (faculty) => faculty.proximityTier !== "other",
  );

  if (hasSelectedGovernorate) {
    addFrom(strong("same"), 3);
    addFrom(strong("nearby"), 1);
    addFrom(ambitious("same"), 1);
    addFrom(ambitious("nearby"), 1);
  } else {
    addFrom(strong("other"), 4);
    addFrom(ambitious("other"), 2);
  }

  addFrom(viable, limit - selected.length);
  return selected;
}

export function predictFaculties({
  percentage,
  branch,
  governorate,
}: {
  percentage: number;
  branch: Branch;
  governorate?: string;
}): {
  rankPercentile: number;
  estimatedRank: number;
  studentsAboveScore: number;
  totalStudents: number;
  confidence: "متوسطة";
  predictions: FacultyPrediction[];
} {
  const totalStudents = 730_000;
  const rankPercentile = estimateRankPercentile(percentage);
  const studentsAboveScore = Math.round(rankPercentile * totalStudents);

  const predictions = facultySeeds
    .filter((faculty) => faculty.branch === branch)
    .map((faculty) => {
      const category = classifyExpectedRange(
        percentage,
        faculty.expectedRange,
      );
      const expectedMidpoint =
        (faculty.expectedRange[0] + faculty.expectedRange[1]) / 2;
      const proximityTier = getProximityTier(
        governorate,
        faculty.governorate,
      );

      return {
        ...faculty,
        category,
        confidence: "متوسطة",
        difference: percentage - expectedMidpoint,
        explanation: categoryExplanation[category],
        proximityTier,
        proximityLabel: proximityLabels[proximityTier],
      } satisfies FacultyPrediction;
    })
    .sort(
      (a, b) =>
        categoryOrder[a.category] - categoryOrder[b.category] ||
        proximityRank(a.proximityTier) - proximityRank(b.proximityTier) ||
        Math.abs(a.difference) - Math.abs(b.difference) ||
        b.historicalCutoffs[2025]! - a.historicalCutoffs[2025]!,
    );

  return {
    rankPercentile,
    estimatedRank: studentsAboveScore + 1,
    studentsAboveScore,
    totalStudents,
    confidence: "متوسطة",
    predictions,
  };
}

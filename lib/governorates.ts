export const egyptianGovernorates = [
  "القاهرة",
  "الجيزة",
  "القليوبية",
  "الإسكندرية",
  "البحيرة",
  "مطروح",
  "الغربية",
  "كفر الشيخ",
  "الدقهلية",
  "دمياط",
  "المنوفية",
  "الشرقية",
  "الإسماعيلية",
  "السويس",
  "بورسعيد",
  "شمال سيناء",
  "جنوب سيناء",
  "الفيوم",
  "بني سويف",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "البحر الأحمر",
  "الوادي الجديد",
] as const;

export type EgyptianGovernorate = (typeof egyptianGovernorates)[number];
export type ProximityTier = "same" | "nearby" | "other";

const indicativeRegions: readonly (readonly EgyptianGovernorate[])[] = [
  ["القاهرة", "الجيزة", "القليوبية", "الفيوم", "بني سويف"],
  ["الإسكندرية", "البحيرة", "مطروح", "الغربية", "كفر الشيخ"],
  [
    "الدقهلية",
    "دمياط",
    "المنوفية",
    "الشرقية",
    "الإسماعيلية",
    "السويس",
    "بورسعيد",
    "شمال سيناء",
    "جنوب سيناء",
  ],
  [
    "المنيا",
    "أسيوط",
    "سوهاج",
    "قنا",
    "الأقصر",
    "أسوان",
    "البحر الأحمر",
    "الوادي الجديد",
  ],
];

export const proximityLabels: Record<ProximityTier, string> = {
  same: "في محافظتك",
  nearby: "نطاق قريب استرشادي",
  other: "محافظة أخرى",
};

export function isEgyptianGovernorate(
  value: string,
): value is EgyptianGovernorate {
  return (egyptianGovernorates as readonly string[]).includes(value);
}

export function getProximityTier(
  studentGovernorate: string | null | undefined,
  facultyGovernorate: string,
): ProximityTier {
  if (!studentGovernorate || studentGovernorate === facultyGovernorate) {
    return studentGovernorate ? "same" : "other";
  }

  const sharedRegion = indicativeRegions.some(
    (region) =>
      region.includes(studentGovernorate as EgyptianGovernorate) &&
      region.includes(facultyGovernorate as EgyptianGovernorate),
  );

  return sharedRegion ? "nearby" : "other";
}

export function proximityRank(tier: ProximityTier) {
  return tier === "same" ? 0 : tier === "nearby" ? 1 : 2;
}

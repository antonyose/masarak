import "server-only";

import { paymentSettings } from "@/db/schema";
import { getDatabase } from "@/db/client";

const defaultOfferEndAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

export const defaultPaymentSettings = {
  id: 1,
  fullReportPriceEgp: "99.00",
  singleReportPriceEgp: "35.00",
  singleReportOriginalPriceEgp: "50.00",
  friends3PriceEgp: "69.00",
  friends3Enabled: true,
  autoAcceptPayments: false,
  offerEnabled: true,
  offerTargetProduct: "single" as const,
  offerBadgeText: "عرض لفترة محدودة",
  offerTitle: "عرض التقرير الفردي",
  offerSubtitle: "افتح تقريرك الكامل بسعر خاص",
  offerCtaText: "استفد من العرض",
  offerEndAt: defaultOfferEndAt,
  offerShowCountdown: true,
  offerShowInHeader: true,
  offerShowInPricingCard: true,
  offerShowInLockedOffer: true,
  vodafoneCashNumber: "01001014231",
  vodafoneDeepLink: "http://vf.eg/vfcash?id=mt&qrId=hpSxBH",
  vodafoneEnabled: true,
  orangeCashNumber: "01276101944",
  orangeEnabled: true,
  instapayIdentifier: "01276101944",
  instapayEnabled: true,
  paymentInstructions: "حوّل المبلغ ثم ارفع صورة واضحة لإيصال التحويل.",
  supportContact: "+201276101944",
  freeRecommendationCount: 1,
  homepageStageMessage:
    "المرحلة الثالثة 2026 — الشواغر الرسمية منشورة والاختيارات مرتبة حسب مجموعك",
  updatedBy: null,
  updatedAt: new Date(0),
} as const;

export async function getPaymentSettings() {
  if (!process.env.DATABASE_URL) return defaultPaymentSettings;
  try {
    const [record] = await getDatabase().select().from(paymentSettings).limit(1);
    return record ?? defaultPaymentSettings;
  } catch {
    return defaultPaymentSettings;
  }
}

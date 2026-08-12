import "server-only";

import { paymentSettings } from "@/db/schema";
import { getDatabase } from "@/db/client";

export const defaultPaymentSettings = {
  id: 1,
  fullReportPriceEgp: "99.00",
  singleReportPriceEgp: "35.00",
  friends3PriceEgp: "69.00",
  friends3Enabled: true,
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
    "توقعات تنسيق المرحلة الثانية 2026 — محدثة بعد ظهور نتيجة المرحلة الأولى رسميًا",
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

import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPaymentSettings();
  return NextResponse.json({
    priceEgp: settings.singleReportPriceEgp,
    currency: "EGP",
    products: {
      single: {
        id: "single",
        label: "تقريرك",
        priceEgp: settings.singleReportPriceEgp,
        seatCount: 1,
      },
      friends3: {
        id: "friends_3",
        label: "إنت و2 من صحابك",
        priceEgp: settings.friends3PriceEgp,
        seatCount: 3,
        enabled: settings.friends3Enabled,
        regularTotalEgp: (Number(settings.singleReportPriceEgp) * 3).toFixed(2),
        savingsEgp: Math.max(0, Number(settings.singleReportPriceEgp) * 3 - Number(settings.friends3PriceEgp)).toFixed(2),
      },
    },
    methods: [
      settings.vodafoneEnabled ? { id: "vodafone_cash", label: "فودافون كاش", recipient: settings.vodafoneCashNumber, deepLink: settings.vodafoneDeepLink, logoSrc: "/payment-logos/vodafone-cash.png" } : null,
      settings.orangeEnabled ? { id: "orange_cash", label: "أورنج كاش", recipient: settings.orangeCashNumber, logoSrc: "/payment-logos/orange-cash.png" } : null,
      settings.instapayEnabled ? { id: "instapay", label: "إنستا باي", recipient: settings.instapayIdentifier, logoSrc: "/payment-logos/instapay.png" } : null,
    ].filter(Boolean),
    instructions: settings.paymentInstructions,
    supportContact: settings.supportContact,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPaymentSettings();
  return NextResponse.json({
    priceEgp: settings.fullReportPriceEgp,
    currency: "EGP",
    methods: [
      settings.vodafoneEnabled ? { id: "vodafone_cash", label: "Vodafone Cash", recipient: settings.vodafoneCashNumber, deepLink: settings.vodafoneDeepLink } : null,
      settings.orangeEnabled ? { id: "orange_cash", label: "Orange Cash", recipient: settings.orangeCashNumber } : null,
      settings.instapayEnabled ? { id: "instapay", label: "InstaPay", recipient: settings.instapayIdentifier } : null,
    ].filter(Boolean),
    instructions: settings.paymentInstructions,
    supportContact: settings.supportContact,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

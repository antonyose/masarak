import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPaymentSettings();
  const offerEndAt = settings.offerEndAt ? new Date(settings.offerEndAt) : null;
  const offerProductEnabled = settings.offerTargetProduct !== "friends_3" || settings.friends3Enabled;
  const offerActive = settings.offerEnabled && offerProductEnabled && (!offerEndAt || offerEndAt.getTime() > Date.now());
  return NextResponse.json({
    priceEgp: settings.singleReportPriceEgp,
    currency: "EGP",
    products: {
      single: {
        id: "single",
        label: "تقريرك",
        priceEgp: settings.singleReportPriceEgp,
        seatCount: 1,
        offer: settings.offerTargetProduct === "single" && offerActive && settings.offerShowInPricingCard
          ? {
              badgeText: settings.offerBadgeText,
              title: settings.offerTitle,
              subtitle: settings.offerSubtitle,
              ctaText: settings.offerCtaText,
              endAt: offerEndAt?.toISOString() ?? null,
              showCountdown: settings.offerShowCountdown,
            }
          : null,
      },
      friends3: {
        id: "friends_3",
        label: "إنت و2 من صحابك",
        priceEgp: settings.friends3PriceEgp,
        seatCount: 3,
        enabled: settings.friends3Enabled,
        regularTotalEgp: (Number(settings.singleReportPriceEgp) * 3).toFixed(2),
        savingsEgp: Math.max(0, Number(settings.singleReportPriceEgp) * 3 - Number(settings.friends3PriceEgp)).toFixed(2),
        offer: settings.offerTargetProduct === "friends_3" && offerActive && settings.offerShowInPricingCard
          ? {
              badgeText: settings.offerBadgeText,
              title: settings.offerTitle,
              subtitle: settings.offerSubtitle,
              ctaText: settings.offerCtaText,
              endAt: offerEndAt?.toISOString() ?? null,
              showCountdown: settings.offerShowCountdown,
            }
          : null,
      },
    },
    offer: {
      enabled: settings.offerEnabled,
      active: offerActive,
      targetProduct: settings.offerTargetProduct,
      badgeText: settings.offerBadgeText,
      title: settings.offerTitle,
      subtitle: settings.offerSubtitle,
      ctaText: settings.offerCtaText,
      endAt: offerEndAt?.toISOString() ?? null,
      showCountdown: settings.offerShowCountdown,
      showInHeader: settings.offerShowInHeader,
      showInPricingCard: settings.offerShowInPricingCard,
      showInLockedOffer: settings.offerShowInLockedOffer,
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

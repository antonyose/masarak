import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPaymentSettings();
  const serverNow = new Date();
  const serverNowIso = serverNow.toISOString();
  const offerEndAt = settings.offerEndAt ? new Date(settings.offerEndAt) : null;
  const offerProductEnabled = settings.offerTargetProduct !== "friends_3" || settings.friends3Enabled;
  const offerActive = settings.offerEnabled && offerProductEnabled && (!offerEndAt || offerEndAt.getTime() > serverNow.getTime());
  const singlePrice = Number(settings.singleReportPriceEgp);
  const singleOriginalPrice = Number(settings.singleReportOriginalPriceEgp);
  return NextResponse.json({
    priceEgp: settings.singleReportPriceEgp,
    currency: "EGP",
    serverNow: serverNowIso,
    products: {
      single: {
        id: "single",
        label: "تقريرك",
        priceEgp: settings.singleReportPriceEgp,
        originalPriceEgp: settings.singleReportOriginalPriceEgp,
        savingsEgp: Math.max(0, singleOriginalPrice - singlePrice).toFixed(2),
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
      offerEndsAt: offerEndAt?.toISOString() ?? null,
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

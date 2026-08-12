import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, paymentSettings } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/request-security";
import { getPaymentSettings } from "@/lib/settings";

const settingsSchema = z.object({
  fullReportPriceEgp: z.coerce.number().positive().max(10000),
  singleReportPriceEgp: z.coerce.number().positive().max(10000),
  singleReportOriginalPriceEgp: z.coerce.number().positive().max(10000),
  friends3PriceEgp: z.coerce.number().positive().max(10000),
  friends3Enabled: z.boolean(),
  autoAcceptPayments: z.boolean(),
  offerEnabled: z.boolean(),
  offerTargetProduct: z.enum(["single", "friends_3"]).nullable(),
  offerBadgeText: z.string().trim().min(2).max(80),
  offerTitle: z.string().trim().min(2).max(120),
  offerSubtitle: z.string().trim().min(2).max(180),
  offerCtaText: z.string().trim().min(2).max(60),
  offerEndAt: z.coerce.date().nullable(),
  offerShowCountdown: z.boolean(),
  offerShowInHeader: z.boolean(),
  offerShowInPricingCard: z.boolean(),
  offerShowInLockedOffer: z.boolean(),
  vodafoneCashNumber: z.string().trim().min(6).max(30),
  vodafoneDeepLink: z.url(),
  vodafoneEnabled: z.boolean(),
  orangeCashNumber: z.string().trim().min(6).max(30),
  orangeEnabled: z.boolean(),
  instapayIdentifier: z.string().trim().min(6).max(80),
  instapayEnabled: z.boolean(),
  paymentInstructions: z.string().trim().min(5).max(1000),
  supportContact: z.string().trim().min(6).max(80),
  freeRecommendationCount: z.number().int().min(1).max(10),
  homepageStageMessage: z.string().trim().min(5).max(500),
});

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ settings: await getPaymentSettings() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "الإعدادات غير صحيحة." }, { status: 400 });
    const before = await getPaymentSettings();
    const [after] = await getDatabase().update(paymentSettings).set({ ...parsed.data, fullReportPriceEgp: parsed.data.fullReportPriceEgp.toFixed(2), singleReportPriceEgp: parsed.data.singleReportPriceEgp.toFixed(2), singleReportOriginalPriceEgp: parsed.data.singleReportOriginalPriceEgp.toFixed(2), friends3PriceEgp: parsed.data.friends3PriceEgp.toFixed(2), updatedBy: session.user.id, updatedAt: new Date() }).where(eq(paymentSettings.id, 1)).returning();
    await getDatabase().insert(adminAuditLogs).values({ actorUserId: session.user.id, action: "settings.update", targetType: "payment_settings", targetId: "1", beforeJson: before as unknown as Record<string, unknown>, afterJson: after as unknown as Record<string, unknown> });
    return NextResponse.json({ settings: after });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "تعذر تحديث الإعدادات." }, { status });
  }
}

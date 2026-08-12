import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { getMaxScore } from "@/lib/grade-scales";
import { enforceRateLimit } from "@/lib/request-security";
import { predictionPreviewSchema } from "@/lib/schemas";
import { getPaymentSettings } from "@/lib/settings";
import { calculateActiveStage2Report, publicPredictionPayload } from "@/lib/prediction-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({ request, scope: "prediction-preview", limit: 15, windowSeconds: 60 });
    const parsed = predictionPreviewSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.year !== 2026) {
      return NextResponse.json({ error: "راجع بيانات المجموع والشعبة ثم حاول مرة أخرى." }, { status: 400 });
    }
    const maxScore = getMaxScore(2026, parsed.data.educationSystem);
    if (!maxScore || parsed.data.score > maxScore) {
      return NextResponse.json({ error: "المجموع يتجاوز النهاية العظمى للنظام المختار." }, { status: 400 });
    }
    const percentage = Math.round((parsed.data.score / maxScore) * 10_000) / 100;
    const report = await calculateActiveStage2Report({
      score: parsed.data.score,
      maxScore,
      percentage,
      educationSystem: parsed.data.educationSystem,
      branch: parsed.data.branch,
      governorate: parsed.data.governorate,
      branchSource: "user_provided",
    });
    const settings = await getPaymentSettings();
    await trackEvent("predict");
    return NextResponse.json(
      {
        ...publicPredictionPayload(report, settings.freeRecommendationCount),
        canSave: false,
        saveRequirement: "real_turso_seat_result",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json({ error: "محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." }, { status: 429 });
    }
    console.error("Prediction preview failed:", error);
    return NextResponse.json({ error: "تعذر حساب التوقع الآن." }, { status: 500 });
  }
}

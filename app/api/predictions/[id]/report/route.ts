import { NextResponse } from "next/server";
import { getSeatEntitlement, requirePrediction } from "@/lib/authz";
import { publicPredictionPayload } from "@/lib/prediction-service";
import { getPaymentSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const prediction = await requirePrediction(id);
    const entitlement = await getSeatEntitlement({
      year: prediction.year,
      seatNumber: prediction.seatNumber,
    });
    const report = prediction.resultSnapshotJson as Parameters<typeof publicPredictionPayload>[0];
    if (!entitlement) {
      const settings = await getPaymentSettings();
      const { premium: _premium, ...free } = publicPredictionPayload(
        report,
        settings.freeRecommendationCount,
      );
      return NextResponse.json(
        {
          predictionId: prediction.id,
          ...free,
          premium: false,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      {
        predictionId: prediction.id,
        premium: true,
        unlocked: true,
        message: "التقرير الكامل مفتوح ✓",
        report,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status = error instanceof Error && error.message === "التقرير غير موجود." ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحميل التقرير." },
      { status },
    );
  }
}

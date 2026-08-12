import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/settings";
import { isEgyptianGovernorate } from "@/lib/governorates";
import {
  getSeatEntitlement,
  requirePrediction,
} from "@/lib/authz";
import {
  createPublicImmutablePrediction,
  publicPredictionPayload,
} from "@/lib/prediction-service";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { publicPredictionCreateSchema } from "@/lib/schemas";
import { getSeatPaymentState } from "@/lib/payment-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({
      request,
      scope: "public-prediction-create",
      limit: 10,
      windowSeconds: 300,
    });
    const parsed = publicPredictionCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "راجع رقم الجلوس والشعبة ثم حاول مرة أخرى." },
        { status: 400 },
      );
    }

    const entitlement = await getSeatEntitlement({
      year: 2026,
      seatNumber: parsed.data.seatNumber,
    });
    let branch = parsed.data.branch;
    let governorate = parsed.data.governorate;
    if (entitlement) {
      const origin = await requirePrediction(entitlement.originPredictionId);
      branch = origin.branch === "science" || origin.branch === "mathematics" || origin.branch === "literary"
        ? origin.branch
        : undefined;
      governorate = origin.governorate && isEgyptianGovernorate(origin.governorate)
        ? origin.governorate
        : undefined;
    }
    if (!branch) {
      return NextResponse.json(
        { requiresBranch: true, seatNumber: parsed.data.seatNumber },
        { status: 200, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const { run, report, result } = await createPublicImmutablePrediction({
      seatNumber: parsed.data.seatNumber,
      branch,
      governorate,
    });
    if (entitlement) {
      return NextResponse.json(
        {
          predictionId: run.id,
          premium: true,
          unlocked: true,
          message: "التقرير الكامل مفتوح ✓",
          report,
          result,
          seatNumber: result.seatNumber,
          branch,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const settings = await getPaymentSettings();
    const { premium: _premium, ...free } = publicPredictionPayload(
      report,
      settings.freeRecommendationCount,
    );
    return NextResponse.json(
      {
        predictionId: run.id,
        ...free,
        premium: false,
        paymentState: await getSeatPaymentState({
          year: 2026,
          seatNumber: result.seatNumber,
        }),
        result,
        seatNumber: result.seatNumber,
        branch,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "طلب غير صالح." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_STAGE2_MODEL") {
      return NextResponse.json({ error: "التوقعات غير متاحة حاليًا." }, { status: 503 });
    }
    if (error instanceof Error && error.message === "RESULT_NOT_FOUND") {
      return NextResponse.json({ error: "راجع رقم الجلوس وحاول تاني." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "UNSUPPORTED_RESULT_SYSTEM") {
      return NextResponse.json({ error: "بيانات النظام الدراسي غير مكتملة." }, { status: 422 });
    }
    console.error("Public prediction failed:", error);
    return NextResponse.json({ error: "تعذر تجهيز التوقع الآن." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { predictionRuns } from "@/db/schema";
import { AuthorizationError, hasSeatEntitlement, requireOwnedStudent, requireSession } from "@/lib/authz";
import { createImmutablePrediction, publicPredictionPayload } from "@/lib/prediction-service";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { predictionCreateSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const runs = await getDatabase()
      .select({
        id: predictionRuns.id,
        savedStudentId: predictionRuns.savedStudentId,
        year: predictionRuns.year,
        coordinationStage: predictionRuns.coordinationStage,
        modelMode: predictionRuns.modelMode,
        percentage: predictionRuns.percentage,
        branch: predictionRuns.branch,
        governorate: predictionRuns.governorate,
        createdAt: predictionRuns.createdAt,
      })
      .from(predictionRuns)
      .where(eq(predictionRuns.userId, session.user.id))
      .orderBy(desc(predictionRuns.createdAt));
    return NextResponse.json({ predictions: runs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "يجب تسجيل الدخول." : "تعذر تحميل سجل التوقعات." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({ request, scope: "prediction-create", limit: 10, windowSeconds: 300 });
    const session = await requireSession();
    const parsed = predictionCreateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "بيانات التوقع غير صحيحة." }, { status: 400 });
    const student = await requireOwnedStudent(parsed.data.savedStudentId, session.user.id);
    const { run, report } = await createImmutablePrediction({ userId: session.user.id, student, governorate: parsed.data.governorate });
    const premium = await hasSeatEntitlement({ year: 2026, seatNumber: student.seatNumber });
    return NextResponse.json(
      premium
        ? { predictionId: run.id, premium: true, report }
        : { predictionId: run.id, ...publicPredictionPayload(report, run.freeRecommendationCountSnapshot) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : error instanceof Error && error.message === "NO_ACTIVE_STAGE2_MODEL" ? 503 : 500;
    console.error("Prediction creation failed:", error);
    return NextResponse.json({ error: status === 401 ? "يجب تسجيل الدخول." : status === 404 ? "النتيجة المحفوظة غير موجودة." : "تعذر إنشاء التوقع." }, { status });
  }
}

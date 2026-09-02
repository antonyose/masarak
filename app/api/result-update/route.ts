import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { updatedStudentResults } from "@/db/schema";
import { getOptionalSession } from "@/lib/authz";
import { findResultBySeat } from "@/lib/results-repository";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { studentResultUpdateSchema } from "@/lib/schemas";
import { getMaxScore } from "@/lib/grade-scales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({
      request,
      scope: "result-update",
      limit: 10,
      windowSeconds: 60,
    });

    const parsed = studentResultUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات النتيجة غير صحيحة." },
        { status: 400 },
      );
    }

    const { year, seatNumber, score, percentage, inputMethod } = parsed.data;
    const baseResult = await findResultBySeat(year, seatNumber);
    if (!baseResult) {
      return NextResponse.json(
        { error: "لم نعثر على نتيجة برقم الجلوس هذا." },
        { status: 404 },
      );
    }

    const system = baseResult.educationSystem === "new" || baseResult.educationSystem === "old"
      ? baseResult.educationSystem
      : "new";
    const maxScore = baseResult.maxScore ?? getMaxScore(year, system) ?? 320;

    if (score > maxScore) {
      return NextResponse.json(
        { error: `المجموع لا يمكن أن يتجاوز الحد الأقصى (${maxScore} درجة).` },
        { status: 400 },
      );
    }

    if (percentage > 100 || percentage < 0) {
      return NextResponse.json(
        { error: "النسبة المئوية يجب أن تكون بين 0% و 100%." },
        { status: 400 },
      );
    }

    const originalScore = baseResult.originalTotalScore ?? baseResult.totalScore;
    if (originalScore !== null && score < originalScore) {
      return NextResponse.json(
        { error: "المجموع الجديد لا يمكن أن يكون أقل من مجموعك في الدور الأول." },
        { status: 400 },
      );
    }

    const session = await getOptionalSession();
    const originalPercentage = baseResult.originalPercentage ?? baseResult.percentage;

    const [upserted] = await getDatabase()
      .insert(updatedStudentResults)
      .values({
        year,
        seatNumber: baseResult.seatNumber,
        updatedTotalScore: score,
        updatedPercentage: percentage,
        maxScore,
        originalTotalScore: originalScore,
        originalPercentage,
        inputMethod,
        userId: session?.user?.id ?? null,
      })
      .onConflictDoUpdate({
        target: [updatedStudentResults.year, updatedStudentResults.seatNumber],
        set: {
          updatedTotalScore: score,
          updatedPercentage: percentage,
          maxScore,
          originalTotalScore: originalScore,
          originalPercentage,
          inputMethod,
          userId: session?.user?.id ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      result: {
        ...baseResult,
        totalScore: upserted.updatedTotalScore,
        percentage: upserted.updatedPercentage,
        maxScore: upserted.maxScore,
        isUpdatedResult: true,
        originalTotalScore: upserted.originalTotalScore,
        originalPercentage: upserted.originalPercentage,
        canPromptRound2: false,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "طلب غير صالح." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "تم إجراء محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." },
        { status: 429 },
      );
    }
    console.error("Result update failed:", error);
    return NextResponse.json(
      { error: "تعذر تحديث النتيجة الآن. حاول مرة أخرى بعد قليل." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { savedStudents } from "@/db/schema";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { savedStudentSchema } from "@/lib/schemas";
import { findTursoResultBySeat } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const records = await getDatabase()
      .select()
      .from(savedStudents)
      .where(eq(savedStudents.userId, session.user.id))
      .orderBy(desc(savedStudents.createdAt));
    return NextResponse.json({ students: records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "يجب تسجيل الدخول." : "تعذر تحميل النتائج المحفوظة." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({ request, scope: "save-student", limit: 8, windowSeconds: 300 });
    const session = await requireSession();
    const parsed = savedStudentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "بيانات النتيجة غير صحيحة." }, { status: 400 });
    const result = await findTursoResultBySeat(2026, parsed.data.seatNumber);
    if (!result || result.totalScore == null || result.maxScore == null || result.percentage == null) {
      return NextResponse.json({ error: "لم نجد نتيجة 2026 مكتملة برقم الجلوس هذا في المصدر الرسمي." }, { status: 404 });
    }
    if (result.educationSystem !== "new" && result.educationSystem !== "old") {
      return NextResponse.json({ error: "نظام الثانوية غير متاح في سجل النتيجة." }, { status: 422 });
    }
    const [created] = await getDatabase()
      .insert(savedStudents)
      .values({
        userId: session.user.id,
        year: 2026,
        seatNumber: result.seatNumber,
        studentNameSnapshot: result.studentName,
        educationSystem: result.educationSystem,
        scoreSnapshot: result.totalScore,
        maxScoreSnapshot: result.maxScore,
        percentageSnapshot: result.percentage,
        branch: parsed.data.branch,
        branchSource: "user_provided",
        resultStatusSnapshot: result.resultStatus,
        resultSnapshotJson: result,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return NextResponse.json({ student: created }, { status: 201 });
    const [matching] = await getDatabase()
      .select()
      .from(savedStudents)
      .where(
        and(
          eq(savedStudents.userId, session.user.id),
          eq(savedStudents.year, 2026),
          eq(savedStudents.seatNumber, result.seatNumber),
        ),
      )
      .limit(1);
    if (
      matching &&
      (matching.branch !== parsed.data.branch ||
        matching.scoreSnapshot !== result.totalScore ||
        matching.maxScoreSnapshot !== result.maxScore)
    ) {
      return NextResponse.json(
        { error: "النتيجة محفوظة بالفعل بلقطة مختلفة وتحتاج مراجعة صريحة بدل تعديلها." },
        { status: 409 },
      );
    }
    return NextResponse.json({ student: matching, existing: true });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : error instanceof Error && error.message === "INVALID_ORIGIN" ? 403 : 500;
    console.error("Save student failed:", error);
    return NextResponse.json({ error: status === 401 ? "يجب تسجيل الدخول." : "تعذر حفظ النتيجة." }, { status });
  }
}

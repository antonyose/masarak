import { NextResponse } from "next/server";
import { AuthorizationError, hasAnnualEntitlement, requireOwnedPrediction, requireSession } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const prediction = await requireOwnedPrediction(id, session.user.id);
    const entitled = await hasAnnualEntitlement({
      userId: session.user.id,
      savedStudentId: prediction.savedStudentId,
      year: prediction.year,
    });
    if (!entitled) throw new AuthorizationError(403, "هذا التقرير يحتاج إلى تفعيل.");
    return NextResponse.json(
      { predictionId: prediction.id, premium: true, report: prediction.resultSnapshotJson },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل التقرير." }, { status });
  }
}

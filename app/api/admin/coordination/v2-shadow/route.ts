import { NextResponse } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { predictionV2ShadowDiagnostics } from "@/lib/prediction-v2/shadow-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(predictionV2ShadowDiagnostics(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 || status === 403 ? "غير مصرح بالوصول." : "تعذر تجهيز تشخيص V2." },
      { status },
    );
  }
}

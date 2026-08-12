import { NextResponse } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import {
  PREDICTION_V2_SHADOW_VERSION,
  predictionV2ShadowDiagnostics,
} from "@/lib/prediction-v2/shadow-service";
import { getDatabase } from "@/db/client";
import { coordinationCycles, modelVersions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [activeModel] = await getDatabase()
      .select({ version: modelVersions.version, activatedAt: modelVersions.activatedAt })
      .from(coordinationCycles)
      .innerJoin(modelVersions, eq(coordinationCycles.activeModelVersionId, modelVersions.id))
      .where(eq(coordinationCycles.year, 2026))
      .limit(1);
    return NextResponse.json({
      ...predictionV2ShadowDiagnostics(),
      activation: {
        active: activeModel?.version === PREDICTION_V2_SHADOW_VERSION,
        activeModelVersion: activeModel?.version ?? null,
        activatedAt: activeModel?.activatedAt ?? null,
      },
    }, {
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

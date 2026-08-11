import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { coordinationSources, modelVersions, officialCutoffs, stageVacancies } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const db = getDatabase();
    const [[sources], [cutoffs], [vacancies], models] = await Promise.all([
      db.select({ count: count() }).from(coordinationSources),
      db.select({ count: count() }).from(officialCutoffs).where(eq(officialCutoffs.year, 2026)),
      db.select({ count: count() }).from(stageVacancies).where(eq(stageVacancies.year, 2026)),
      db.select({ id: modelVersions.id, version: modelVersions.version, year: modelVersions.year, stage: modelVersions.stage, activatedAt: modelVersions.activatedAt, backtest: modelVersions.backtestMetricsJson }).from(modelVersions),
    ]);
    return NextResponse.json({ counts: { sources: sources.count, officialCutoffs2026: cutoffs.count, stageVacancies2026: vacancies.count }, models }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

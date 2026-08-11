import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/analytics";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const data = await getAnalytics();
    return NextResponse.json({ totalViews: data.totalViews, todayViews: data.todayViews, predictCount: data.predictCount, searchCount: data.searchCount, lastVisit: data.lastVisit });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status });
  }
}

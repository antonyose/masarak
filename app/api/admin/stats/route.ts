import { NextResponse } from "next/server";
import { getAnalytics, getBehaviorAnalytics, getDailyTimeSeries, getFunnelAnalytics, getRevenueAnalytics, getUserStats } from "@/lib/analytics";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const days = Math.min(Number(url.searchParams.get("days")) || 14, 90);
    const [basic, timeSeries, funnel, behavior, revenue, users] = await Promise.all([
      getAnalytics(),
      getDailyTimeSeries(days),
      getFunnelAnalytics(30),
      getBehaviorAnalytics(30),
      getRevenueAnalytics(),
      getUserStats(),
    ]);
    return NextResponse.json({ ...basic, timeSeries, funnel, behavior, revenue, users });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    if (!(error instanceof AuthorizationError)) console.error("Failed to load admin analytics:", error);
    return NextResponse.json(
      { error: status === 403 ? "غير مصرح بالوصول" : "تعذر تحميل التحليلات" },
      { status },
    );
  }
}

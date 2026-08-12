import { NextResponse } from "next/server";
import { getAnalytics, getDailyTimeSeries, getFunnelAnalytics, getRevenueAnalytics, getUserStats } from "@/lib/analytics";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const days = Math.min(Number(url.searchParams.get("days")) || 14, 90);
    const [basic, timeSeries, funnel, revenue, users] = await Promise.all([
      getAnalytics(),
      getDailyTimeSeries(days),
      getFunnelAnalytics(days),
      getRevenueAnalytics(),
      getUserStats(),
    ]);
    return NextResponse.json({ ...basic, timeSeries, funnel, revenue, users });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("masarak_admin_token")?.value;

  if (token !== "authenticated_session_active") {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 401 });
  }

  const data = await getAnalytics();

  return NextResponse.json({
    totalViews: data.totalViews,
    todayViews: data.todayViews,
    predictCount: data.predictCount,
    searchCount: data.searchCount,
    lastVisit: data.lastVisit,
  });
}

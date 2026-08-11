import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { adminAuditLogs } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const logs = await getDatabase().select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(200);
    return NextResponse.json({ logs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

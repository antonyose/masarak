import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, user } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    const action = params.get("action")?.trim() ?? "";
    const limit = Math.min(Math.max(Number(params.get("limit")) || 300, 1), 1000);
    const filters = [];
    if (action) filters.push(eq(adminAuditLogs.action, action));
    if (query) {
      filters.push(or(
        ilike(adminAuditLogs.action, `%${query}%`),
        ilike(adminAuditLogs.targetType, `%${query}%`),
        ilike(adminAuditLogs.targetId, `%${query}%`),
        ilike(user.name, `%${query}%`),
        ilike(user.email, `%${query}%`),
      ));
    }
    const logs = await getDatabase()
      .select({
        id: adminAuditLogs.id,
        actorUserId: adminAuditLogs.actorUserId,
        actorName: user.name,
        actorEmail: user.email,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        beforeJson: adminAuditLogs.beforeJson,
        afterJson: adminAuditLogs.afterJson,
        requestId: adminAuditLogs.requestId,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .leftJoin(user, eq(user.id, adminAuditLogs.actorUserId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
    return NextResponse.json({ logs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status });
  }
}

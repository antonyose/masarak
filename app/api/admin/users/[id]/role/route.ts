import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, user } from "@/db/schema";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/request-security";

const roleSchema = z.object({ role: z.enum(["user", "admin"]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "الدور غير صحيح." }, { status: 400 });
    const { id } = await context.params;
    const [before] = await getDatabase().select({ id: user.id, role: user.role, email: user.email }).from(user).where(eq(user.id, id)).limit(1);
    if (!before) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
    if (id === session.user.id && parsed.data.role !== "admin") return NextResponse.json({ error: "لا يمكنك إزالة صلاحيتك من نفس الجلسة." }, { status: 409 });
    const [after] = await getDatabase().update(user).set({ role: parsed.data.role, updatedAt: new Date() }).where(eq(user.id, id)).returning({ id: user.id, role: user.role, email: user.email });
    await getDatabase().insert(adminAuditLogs).values({ actorUserId: session.user.id, action: "user.role.update", targetType: "user", targetId: id, beforeJson: before, afterJson: after });
    return NextResponse.json({ user: after });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "تعذر تحديث الدور." }, { status });
  }
}

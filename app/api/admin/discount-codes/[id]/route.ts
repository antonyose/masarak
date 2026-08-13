import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminAuditLogs, discountCodes } from "@/db/schema";
import { getDatabase } from "@/db/client";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/request-security";
import { adminDiscountCodeUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const parsed = adminDiscountCodeUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة." }, { status: 400 });
    const { id } = await context.params;
    const [before] = await getDatabase().select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
    if (!before) return NextResponse.json({ error: "الكود غير موجود." }, { status: 404 });
    const [after] = await getDatabase().update(discountCodes).set({ active: parsed.data.active, updatedAt: new Date() }).where(eq(discountCodes.id, id)).returning();
    await getDatabase().insert(adminAuditLogs).values({ actorUserId: session.user.id, action: parsed.data.active ? "discount_code.activated" : "discount_code.deactivated", targetType: "discount_code", targetId: id, beforeJson: before as unknown as Record<string, unknown>, afterJson: after as unknown as Record<string, unknown> });
    return NextResponse.json({ code: after });
  } catch (error) {
    return NextResponse.json({ error: "تعذر تحديث الكود." }, { status: error instanceof AuthorizationError ? error.status : 500 });
  }
}

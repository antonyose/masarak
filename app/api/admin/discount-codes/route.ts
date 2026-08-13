import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { adminAuditLogs, discountCodes, discountRedemptions } from "@/db/schema";
import { getDatabase } from "@/db/client";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/request-security";
import { adminDiscountCodeCreateSchema } from "@/lib/schemas";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode() {
  const bytes = randomBytes(4);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function GET() {
  try {
    await requireAdmin();
    const rows = await getDatabase()
      .select({
        id: discountCodes.id, code: discountCodes.code, discountType: discountCodes.discountType,
        discountValue: discountCodes.discountValue, maxRedemptions: discountCodes.maxRedemptions,
        active: discountCodes.active, expiresAt: discountCodes.expiresAt, createdAt: discountCodes.createdAt,
        usedCount: sql<number>`count(${discountRedemptions.id}) filter (where ${discountRedemptions.status} in ('reserved', 'redeemed'))::int`,
      })
      .from(discountCodes)
      .leftJoin(discountRedemptions, eq(discountRedemptions.discountCodeId, discountCodes.id))
      .groupBy(discountCodes.id)
      .orderBy(desc(discountCodes.createdAt));
    return NextResponse.json({ codes: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "غير مصرح بالوصول." }, { status: error instanceof AuthorizationError ? error.status : 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const parsed = adminDiscountCodeCreateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    let created: typeof discountCodes.$inferSelect | undefined;
    for (let attempt = 0; attempt < 8 && !created; attempt += 1) {
      const code = parsed.data.code ?? generateCode();
      const [row] = await getDatabase().insert(discountCodes).values({
        code,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue.toFixed(2),
        maxRedemptions: parsed.data.maxRedemptions,
        expiresAt: parsed.data.expiresAt ?? null,
        createdBy: session.user.id,
      }).onConflictDoNothing({ target: discountCodes.code }).returning();
      created = row;
      if (parsed.data.code && !created) break;
    }
    if (!created) return NextResponse.json({ error: parsed.data.code ? "الكود مستخدم بالفعل." : "تعذر توليد كود فريد." }, { status: 409 });
    await getDatabase().insert(adminAuditLogs).values({ actorUserId: session.user.id, action: "discount_code.created", targetType: "discount_code", targetId: created.id, afterJson: created as unknown as Record<string, unknown> });
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (error) {
    if (!(error instanceof AuthorizationError)) console.error("Discount code creation failed:", error);
    return NextResponse.json({ error: "تعذر إنشاء كود الخصم." }, { status: error instanceof AuthorizationError ? error.status : 500 });
  }
}

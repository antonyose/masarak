import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { user } from "@/db/schema";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/request-security";
import { accountUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const [record] = await getDatabase().select({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, image: user.image }).from(user).where(eq(user.id, session.user.id)).limit(1);
    return NextResponse.json({ account: record }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const parsed = accountUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الحساب غير صحيحة." }, { status: 400 });
    const [record] = await getDatabase().update(user).set({ name: parsed.data.name, phone: parsed.data.phone, updatedAt: new Date() }).where(eq(user.id, session.user.id)).returning({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
    return NextResponse.json({ account: record });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "يجب تسجيل الدخول." : "تعذر تحديث الحساب." }, { status });
  }
}

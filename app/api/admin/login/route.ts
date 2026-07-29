import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "masarak2026";

export async function POST(request: Request) {
  try {
    const { password } = await request.json().catch(() => ({}));
    if (password === ADMIN_PASSWORD) {
      const cookieStore = await cookies();
      cookieStore.set("masarak_admin_token", "authenticated_session_active", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: "كلمة السر غير صحيحة" },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("masarak_admin_token");
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "تم إلغاء دخول الأدمن بكلمة سر مستقلة. استخدم حساب Better Auth المرقّى." },
    { status: 410 },
  );
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { grantManualSeatEntitlement } from "@/lib/manual-entitlement";
import { normalizeDigits } from "@/lib/normalize-arabic";
import { assertSameOrigin } from "@/lib/request-security";
import { adminManualEntitlementSchema } from "@/lib/schemas";
import { findResultBySeat } from "@/lib/results-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const parsed = adminManualEntitlementSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات التفعيل غير صحيحة." },
        { status: 400 },
      );
    }
    const seatNumber = normalizeDigits(parsed.data.seatNumber);
    const student = await findResultBySeat(parsed.data.year, seatNumber);
    if (!student) {
      return NextResponse.json({ error: "رقم الجلوس غير موجود في نتائج 2026." }, { status: 404 });
    }
    const result = await grantManualSeatEntitlement({
      ...parsed.data,
      seatNumber,
      studentName: student.studentName,
      amount: parsed.data.recordRevenue ? parsed.data.amount : 0,
      method: parsed.data.recordRevenue ? parsed.data.method : null,
      actorUserId: session.user.id,
      requestId: request.headers.get("x-request-id") ?? randomUUID(),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = error instanceof AuthorizationError
      ? error.status
      : message === "SEAT_ALREADY_UNLOCKED"
        ? 409
        : 500;
    if (status === 500) console.error("Manual entitlement failed:", error);
    return NextResponse.json(
      { error: message === "SEAT_ALREADY_UNLOCKED" ? "رقم الجلوس مفعّل بالفعل." : "تعذر تفعيل رقم الجلوس." },
      { status },
    );
  }
}

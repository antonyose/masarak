import { NextResponse } from "next/server";
import { getSeatPaymentState } from "@/lib/payment-state";
import { normalizeDigits } from "@/lib/normalize-arabic";
import { enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceRateLimit({ request, scope: "payment-status", limit: 30, windowSeconds: 60 });
    const params = new URL(request.url).searchParams;
    const year = Number(params.get("year"));
    const seatNumber = normalizeDigits(params.get("seatNumber") ?? "");
    if (year !== 2026 || !/^\d{4,14}$/.test(seatNumber)) {
      return NextResponse.json({ error: "رقم الجلوس غير صحيح." }, { status: 400 });
    }
    const state = await getSeatPaymentState({ year, seatNumber });
    return NextResponse.json(state, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json({ error: "محاولات كثيرة. انتظر قليلًا." }, { status: 429 });
    }
    return NextResponse.json({ error: "تعذر قراءة حالة الدفع." }, { status: 500 });
  }
}

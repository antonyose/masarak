import { NextResponse } from "next/server";
import { getDiscountQuote } from "@/lib/discount-codes";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { discountValidationSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit({ request, scope: "discount-validate", limit: 12, windowSeconds: 600 });
    const parsed = discountValidationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ valid: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    const quote = await getDiscountQuote(parsed.data.code, parsed.data.productType);
    if (!quote) return NextResponse.json({ valid: false, error: "الكود غير صالح أو انتهى عدد استخداماته." }, { status: 404 });
    return NextResponse.json({ valid: true, quote }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const limited = error instanceof Error && error.message === "RATE_LIMITED";
    return NextResponse.json({ valid: false, error: limited ? "محاولات كثيرة. جرّب بعد دقيقة." : "تعذر التحقق من الكود." }, { status: limited ? 429 : 500 });
  }
}

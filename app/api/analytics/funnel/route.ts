import { NextResponse } from "next/server";
import { trackFunnelEvent } from "@/lib/analytics";

const ALLOWED_EVENTS = new Set([
  "page_view", "search_result", "offer_viewed", "offer_clicked",
  "pricing_opened", "pricing_cta_clicked", "product_selected",
  "receipt_uploaded", "payment_submitted", "header_offer_clicked",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name : "";
    if (!ALLOWED_EVENTS.has(name)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }
    await trackFunnelEvent(name, typeof body.metadata === "object" ? body.metadata : undefined);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

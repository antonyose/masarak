import { NextResponse } from "next/server";
import { trackFunnelEvent } from "@/lib/analytics";

const ALLOWED_EVENTS = new Set([
  "page_view", "engaged_view", "search_result", "report_viewed",
  "offer_viewed", "offer_clicked",
  "pricing_opened", "pricing_cta_clicked", "product_selected",
  "receipt_uploaded", "payment_started", "payment_submitted", "header_offer_clicked",
]);

function sanitizedMetadata(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  if (typeof source.path === "string" && source.path.startsWith("/")) {
    metadata.path = source.path.slice(0, 200);
  }
  if (source.product === "single" || source.product === "friends_3") {
    metadata.product = source.product;
  }
  if (typeof source.source === "string" && /^[a-z_]{1,40}$/.test(source.source)) {
    metadata.source = source.source;
  }
  return metadata;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name : "";
    if (!ALLOWED_EVENTS.has(name)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }
    const sessionId = typeof body.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(body.sessionId)
      ? body.sessionId
      : undefined;
    await trackFunnelEvent(name, sanitizedMetadata(body.metadata), {
      sessionId,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type === "predict" || body.type === "search" ? body.type : "view";
    await trackEvent(type);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to record analytics" },
      { status: 500 },
    );
  }
}

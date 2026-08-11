import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { egyptianPhoneSchema } from "@/lib/schemas";
import { z } from "zod";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

const emailSignupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  phone: egyptianPhoneSchema,
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  let forwardedRequest = request;
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    const raw = await request.clone().json().catch(() => null);
    const parsed = emailSignupSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "بيانات إنشاء الحساب غير مكتملة." },
        { status: 400 },
      );
    }
    forwardedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify({
        ...(raw as Record<string, unknown>),
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
      }),
    });
  }
  return handler.POST(forwardedRequest);
}

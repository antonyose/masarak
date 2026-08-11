import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw new Error("INVALID_ORIGIN");
}

export async function enforceRateLimit({
  request,
  scope,
  limit,
  windowSeconds,
}: {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
}) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || !process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") throw new Error("RATE_LIMIT_NOT_CONFIGURED");
    return;
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const identity = forwarded || "unknown";
  const key = createHmac("sha256", secret)
    .update(`${scope}:${identity}`)
    .digest("hex");
  const result = await getDatabase().execute(sql`
    INSERT INTO rate_limits (scope, "key", window_start, "count", expires_at)
    VALUES (${scope}, ${key}, now(), 1, now() + (${windowSeconds} * interval '1 second'))
    ON CONFLICT (scope, "key") DO UPDATE SET
      "count" = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits."count" + 1 END,
      window_start = CASE WHEN rate_limits.expires_at <= now() THEN now() ELSE rate_limits.window_start END,
      expires_at = CASE
        WHEN rate_limits.expires_at <= now()
          THEN now() + (${windowSeconds} * interval '1 second')
        ELSE rate_limits.expires_at
      END
    RETURNING "count", expires_at
  const row = ((result as any).rows ? (result as any).rows[0] : (result as any)[0]) as { count?: number } | undefined;
  if (Number(row?.count ?? 1) > limit) throw new Error("RATE_LIMITED");
}

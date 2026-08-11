import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";

export const authRateLimitStorage = {
  async get(key: string) {
    const result = await getDatabase().execute(sql`
      SELECT "count", window_start AS "lastRequest"
      FROM rate_limits
      WHERE scope = 'auth' AND "key" = ${key} AND expires_at > now()
      LIMIT 1
    `);
    const row = result.rows[0] as { count?: number; lastRequest?: Date | string } | undefined;
    if (!row) return null;
    return { key, count: Number(row.count ?? 0), lastRequest: new Date(row.lastRequest!).getTime() };
  },
  async set(key: string, value: { count: number; lastRequest: number }) {
    const lastRequest = new Date(value.lastRequest);
    await getDatabase().execute(sql`
      INSERT INTO rate_limits (scope, "key", window_start, "count", expires_at)
      VALUES ('auth', ${key}, ${lastRequest}, ${value.count}, ${lastRequest} + interval '1 day')
      ON CONFLICT (scope, "key") DO UPDATE SET
        window_start = EXCLUDED.window_start,
        "count" = EXCLUDED."count",
        expires_at = EXCLUDED.expires_at
    `);
  },
};

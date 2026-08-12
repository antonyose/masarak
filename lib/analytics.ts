import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";

export type AnalyticsData = {
  totalViews: number;
  todayViews: number;
  predictCount: number;
  searchCount: number;
  lastVisit: string;
};

/**
 * Ensures the analytics_events table exists (runs once per cold start).
 * Uses IF NOT EXISTS so it's safe to call repeatedly.
 */
async function ensureTable() {
  const db = getDatabase();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_type_date_idx
    ON analytics_events (event_type, event_date)
  `);
}

let tableReady = false;

async function ready() {
  if (!tableReady) {
    await ensureTable();
    tableReady = true;
  }
}

export async function trackEvent(type: "view" | "predict" | "search") {
  try {
    if (!process.env.DATABASE_URL) return;
    await ready();
    const db = getDatabase();
    const today = new Date().toISOString().split("T")[0];

    await db.execute(sql`
      INSERT INTO analytics_events (event_type, event_date, count)
      VALUES (${type}, ${today}, 1)
      ON CONFLICT (event_type, event_date) DO UPDATE
      SET count = analytics_events.count + 1
    `);
  } catch (error) {
    console.error("Failed to track analytics event:", error);
  }
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const today = new Date().toISOString().split("T")[0];
  const defaultAnalytics: AnalyticsData = {
    totalViews: 0,
    todayViews: 0,
    predictCount: 0,
    searchCount: 0,
    lastVisit: today,
  };

  try {
    if (!process.env.DATABASE_URL) return defaultAnalytics;
    await ready();
    const db = getDatabase();

    const rows = await db.execute(sql`
      SELECT event_type, event_date, count
      FROM analytics_events
    `);

    let totalViews = 0;
    let todayViews = 0;
    let predictCount = 0;
    let searchCount = 0;
    let lastVisit = "";

    for (const row of rows.rows) {
      const eventType = row.event_type as string;
      const eventDate = row.event_date as string;
      const count = Number(row.count);

      if (eventType === "view") {
        totalViews += count;
        if (eventDate === today) todayViews = count;
        if (eventDate > lastVisit) lastVisit = eventDate;
      } else if (eventType === "predict") {
        predictCount += count;
      } else if (eventType === "search") {
        searchCount += count;
      }
    }

    return {
      totalViews,
      todayViews,
      predictCount,
      searchCount,
      lastVisit: lastVisit || today,
    };
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return defaultAnalytics;
  }
}

/* ─── Funnel Event Tracking ─── */

export async function trackFunnelEvent(name: string, metadata?: Record<string, unknown>) {
  try {
    if (!process.env.DATABASE_URL) return;
    await ready();
    const db = getDatabase();
    const today = new Date().toISOString().split("T")[0];
    const hour = new Date().getUTCHours();
    await db.execute(sql`
      INSERT INTO funnel_events (event_name, event_date, event_hour, count, metadata_json)
      VALUES (${name}, ${today}::date, ${hour}, 1, ${JSON.stringify(metadata ?? {})}::jsonb)
      ON CONFLICT (event_name, event_date, event_hour) DO UPDATE
      SET count = funnel_events.count + 1
    `);
  } catch (error) {
    console.error("Failed to track funnel event:", error);
  }
}

export async function getFunnelAnalytics(days = 30) {
  try {
    if (!process.env.DATABASE_URL) return [];
    await ready();
    const db = getDatabase();
    const rows = await db.execute(sql`
      SELECT event_name, SUM(count)::int AS total
      FROM funnel_events
      WHERE event_date >= CURRENT_DATE - ${days}
      GROUP BY event_name
      ORDER BY total DESC
    `);
    return rows.rows as Array<{ event_name: string; total: number }>;
  } catch {
    return [];
  }
}

export async function getDailyTimeSeries(days = 14) {
  try {
    if (!process.env.DATABASE_URL) return [];
    await ready();
    const db = getDatabase();
    const rows = await db.execute(sql`
      SELECT event_date::text AS date, event_type, SUM(count)::int AS total
      FROM analytics_events
      WHERE event_date >= (CURRENT_DATE - ${days})::text
      GROUP BY event_date, event_type
      ORDER BY event_date ASC
    `);
    return rows.rows as Array<{ date: string; event_type: string; total: number }>;
  } catch {
    return [];
  }
}

export async function getRevenueAnalytics() {
  const empty = { totalRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, totalApproved: 0, totalPending: 0, totalRejected: 0, byProduct: [] as Array<{ product_type: string; count: number; revenue: number }>, byMethod: [] as Array<{ method: string; count: number; revenue: number }> };
  try {
    if (!process.env.DATABASE_URL) return empty;
    const db = getDatabase();
    const totals = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' THEN expected_amount::numeric ELSE 0 END), 0)::numeric AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'approved' AND reviewed_at >= CURRENT_DATE THEN expected_amount::numeric ELSE 0 END), 0)::numeric AS today_revenue,
        COALESCE(SUM(CASE WHEN status = 'approved' AND reviewed_at >= CURRENT_DATE - 7 THEN expected_amount::numeric ELSE 0 END), 0)::numeric AS week_revenue,
        COALESCE(SUM(CASE WHEN status = 'approved' AND reviewed_at >= CURRENT_DATE - 30 THEN expected_amount::numeric ELSE 0 END), 0)::numeric AS month_revenue,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS total_approved,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS total_pending,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS total_rejected
      FROM payment_submissions
    `);
    const byProduct = await db.execute(sql`
      SELECT product_type, COUNT(*)::int AS count, COALESCE(SUM(expected_amount::numeric), 0)::numeric AS revenue
      FROM payment_submissions WHERE status = 'approved'
      GROUP BY product_type
    `);
    const byMethod = await db.execute(sql`
      SELECT method, COUNT(*)::int AS count, COALESCE(SUM(expected_amount::numeric), 0)::numeric AS revenue
      FROM payment_submissions WHERE status = 'approved'
      GROUP BY method
    `);
    const t = totals.rows[0] as Record<string, unknown> | undefined;
    return {
      totalRevenue: Number(t?.total_revenue ?? 0),
      todayRevenue: Number(t?.today_revenue ?? 0),
      weekRevenue: Number(t?.week_revenue ?? 0),
      monthRevenue: Number(t?.month_revenue ?? 0),
      totalApproved: Number(t?.total_approved ?? 0),
      totalPending: Number(t?.total_pending ?? 0),
      totalRejected: Number(t?.total_rejected ?? 0),
      byProduct: byProduct.rows as Array<{ product_type: string; count: number; revenue: number }>,
      byMethod: byMethod.rows as Array<{ method: string; count: number; revenue: number }>,
    };
  } catch (error) {
    console.error("Failed to fetch revenue analytics:", error);
    return empty;
  }
}

export async function getUserStats() {
  try {
    if (!process.env.DATABASE_URL) return { totalUsers: 0, todayUsers: 0, totalEntitlements: 0 };
    const db = getDatabase();
    const rows = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM "user") AS total_users,
        (SELECT COUNT(*)::int FROM "user" WHERE created_at >= CURRENT_DATE) AS today_users,
        (SELECT COUNT(*)::int FROM seat_entitlements) AS total_entitlements
    `);
    const r = rows.rows[0] as Record<string, unknown> | undefined;
    return { totalUsers: Number(r?.total_users ?? 0), todayUsers: Number(r?.today_users ?? 0), totalEntitlements: Number(r?.total_entitlements ?? 0) };
  } catch {
    return { totalUsers: 0, todayUsers: 0, totalEntitlements: 0 };
  }
}


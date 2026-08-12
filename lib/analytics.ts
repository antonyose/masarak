import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import {
  buildBehaviorFunnel,
  buildBehaviorInsights,
  buildBehaviorRates,
  type AnalyticsMode,
  type EventMetric,
} from "@/lib/analytics-insights";

export type AnalyticsData = {
  totalViews: number;
  todayViews: number;
  predictCount: number;
  searchCount: number;
  lastVisit: string;
};

export type BehaviorAnalytics = {
  periodDays: number;
  mode: AnalyticsMode;
  instrumentedAt: string | null;
  uniqueSessions: number;
  minimumSessionSample: number;
  engagedSessions: number;
  totalInteractions: number;
  funnel: ReturnType<typeof buildBehaviorFunnel>;
  rates: ReturnType<typeof buildBehaviorRates>;
  insights: ReturnType<typeof buildBehaviorInsights>;
  busyHours: Array<{ hour: number; total: number }>;
  devices: Array<{ device: string; total: number }>;
  topPaths: Array<{ path: string; total: number }>;
  trafficTrend: Array<{ event_type: string; current_total: number; previous_total: number }>;
};

function getCairoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function deviceType(userAgent?: string) {
  const agent = userAgent?.toLowerCase() ?? "";
  if (/ipad|tablet|kindle|silk/.test(agent)) return "tablet";
  if (/android|iphone|ipod|mobile/.test(agent)) return "mobile";
  if (agent) return "desktop";
  return "unknown";
}

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
    const today = getCairoDate();

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
  const today = getCairoDate();
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

let behaviorTableState: { available: boolean; checkedAt: number } | null = null;

async function behaviorTableAvailable() {
  const now = Date.now();
  if (behaviorTableState && now - behaviorTableState.checkedAt < 5 * 60_000) {
    return behaviorTableState.available;
  }
  const db = getDatabase();
  const result = await db.execute(sql`SELECT to_regclass('public.behavior_events') IS NOT NULL AS available`);
  const available = Boolean(result.rows[0]?.available);
  behaviorTableState = { available, checkedAt: now };
  return available;
}

function anonymousSessionId(sessionId: string) {
  return createHash("sha256").update(`masarak-analytics:${sessionId}`).digest("hex");
}

export async function trackFunnelEvent(
  name: string,
  metadata?: Record<string, string>,
  context?: { sessionId?: string; userAgent?: string },
) {
  try {
    if (!process.env.DATABASE_URL) return;
    await ready();
    const db = getDatabase();
    const today = getCairoDate();
    const hour = new Date().getUTCHours();
    await db.execute(sql`
      INSERT INTO funnel_events (event_name, event_date, event_hour, count, metadata_json)
      VALUES (${name}, ${today}::date, ${hour}, 1, ${JSON.stringify(metadata ?? {})}::jsonb)
      ON CONFLICT (event_name, event_date, event_hour) DO UPDATE
      SET count = funnel_events.count + 1
    `);

    if (context?.sessionId && await behaviorTableAvailable()) {
      const path = metadata?.path?.startsWith("/") ? metadata.path.slice(0, 200) : null;
      const product = metadata?.product === "single" || metadata?.product === "friends_3"
        ? metadata.product
        : null;
      await db.execute(sql`
        INSERT INTO behavior_events (
          event_name, session_id, occurred_at, path, product, device_type, metadata_json
        ) VALUES (
          ${name},
          ${anonymousSessionId(context.sessionId)},
          NOW(),
          ${path},
          ${product},
          ${deviceType(context.userAgent)},
          ${JSON.stringify(metadata ?? {})}::jsonb
        )
      `);
    }
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
      WHERE event_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days}::int * INTERVAL '1 day')
      GROUP BY event_name
      ORDER BY total DESC
    `);
    return rows.rows as Array<{ event_name: string; total: number }>;
  } catch (error) {
    console.error("Failed to fetch funnel analytics:", error);
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
      WHERE event_date::date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days - 1}::int * INTERVAL '1 day')
      GROUP BY event_date, event_type
      ORDER BY event_date ASC
    `);
    return rows.rows as Array<{ date: string; event_type: string; total: number }>;
  } catch (error) {
    console.error("Failed to fetch daily analytics:", error);
    return [];
  }
}

async function getApprovedPaymentsForPeriod(days: number) {
  const db = getDatabase();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM payment_submissions
    WHERE status = 'approved'
      AND COALESCE(submitted_at, created_at) >= NOW() - (${days}::int * INTERVAL '1 day')
  `);
  return Number(result.rows[0]?.total ?? 0);
}

async function getApprovedPaymentsSince(instrumentedAt: string) {
  const db = getDatabase();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM payment_submissions
    WHERE status = 'approved'
      AND COALESCE(submitted_at, created_at) >= ${instrumentedAt}::timestamptz
  `);
  return Number(result.rows[0]?.total ?? 0);
}

async function getTrafficTrend(days: number) {
  const db = getDatabase();
  const rows = await db.execute(sql`
    SELECT
      event_type,
      COALESCE(SUM(count) FILTER (
        WHERE event_date::date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days - 1}::int * INTERVAL '1 day')
      ), 0)::int AS current_total,
      COALESCE(SUM(count) FILTER (
        WHERE event_date::date < (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days - 1}::int * INTERVAL '1 day')
          AND event_date::date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days * 2 - 1}::int * INTERVAL '1 day')
      ), 0)::int AS previous_total
    FROM analytics_events
    WHERE event_date::date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days * 2 - 1}::int * INTERVAL '1 day')
    GROUP BY event_type
  `);
  return rows.rows.map((row) => ({
    event_type: String(row.event_type),
    current_total: Number(row.current_total),
    previous_total: Number(row.previous_total),
  }));
}

export async function getBehaviorAnalytics(days = 30): Promise<BehaviorAnalytics> {
  const minimumSessionSample = 20;
  const empty: BehaviorAnalytics = {
    periodDays: days,
    mode: "aggregate",
    instrumentedAt: null,
    uniqueSessions: 0,
    minimumSessionSample,
    engagedSessions: 0,
    totalInteractions: 0,
    funnel: buildBehaviorFunnel([], 0, "aggregate"),
    rates: buildBehaviorRates(buildBehaviorFunnel([], 0, "aggregate")),
    insights: buildBehaviorInsights(buildBehaviorFunnel([], 0, "aggregate"), "aggregate", 0, 0),
    busyHours: [],
    devices: [],
    topPaths: [],
    trafficTrend: [],
  };

  try {
    if (!process.env.DATABASE_URL) return empty;
    await ready();
    const db = getDatabase();
    const [legacyMetrics, initialApprovedPayments, trafficTrend] = await Promise.all([
      getFunnelAnalytics(days),
      getApprovedPaymentsForPeriod(days),
      getTrafficTrend(Math.min(7, days)),
    ]);

    let mode: AnalyticsMode = "aggregate";
    let approvedPayments = initialApprovedPayments;
    let metrics = legacyMetrics as EventMetric[];
    let uniqueSessions = 0;
    let engagedSessions = 0;
    let totalInteractions = metrics.reduce((sum, metric) => sum + Number(metric.total), 0);
    let instrumentedAt: string | null = null;
    let busyHours: Array<{ hour: number; total: number }> = [];
    let devices: Array<{ device: string; total: number }> = [];
    let topPaths: Array<{ path: string; total: number }> = [];

    if (await behaviorTableAvailable()) {
      const [eventRows, sessionRows, hourRows, deviceRows, pathRows] = await Promise.all([
        db.execute(sql`
          WITH period AS (
            SELECT event_name, session_id
            FROM behavior_events
            WHERE occurred_at >= NOW() - (${days}::int * INTERVAL '1 day')
          ), grouped AS (
            SELECT event_name, COUNT(DISTINCT session_id)::int AS total
            FROM period
            GROUP BY event_name
          ), intent AS (
            SELECT 'checkout_intent'::text AS event_name, COUNT(DISTINCT session_id)::int AS total
            FROM period
            WHERE event_name IN ('header_offer_clicked', 'pricing_cta_clicked', 'product_selected', 'payment_started')
          )
          SELECT event_name, total FROM grouped
          UNION ALL
          SELECT event_name, total FROM intent
        `),
        db.execute(sql`
          SELECT
            COUNT(DISTINCT session_id)::int AS unique_sessions,
            COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'engaged_view')::int AS engaged_sessions,
            COUNT(*)::int AS interactions,
            MIN(occurred_at)::text AS instrumented_at
          FROM behavior_events
          WHERE occurred_at >= NOW() - (${days}::int * INTERVAL '1 day')
        `),
        db.execute(sql`
          SELECT EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Africa/Cairo')::int AS hour,
                 COUNT(DISTINCT session_id)::int AS total
          FROM behavior_events
          WHERE event_name = 'page_view'
            AND occurred_at >= NOW() - (${days}::int * INTERVAL '1 day')
          GROUP BY hour ORDER BY total DESC LIMIT 4
        `),
        db.execute(sql`
          SELECT device_type AS device, COUNT(DISTINCT session_id)::int AS total
          FROM behavior_events
          WHERE occurred_at >= NOW() - (${days}::int * INTERVAL '1 day')
          GROUP BY device_type ORDER BY total DESC
        `),
        db.execute(sql`
          SELECT path, COUNT(DISTINCT session_id)::int AS total
          FROM behavior_events
          WHERE event_name = 'page_view' AND path IS NOT NULL
            AND occurred_at >= NOW() - (${days}::int * INTERVAL '1 day')
          GROUP BY path ORDER BY total DESC LIMIT 5
        `),
      ]);
      const sessionSummary = sessionRows.rows[0];
      uniqueSessions = Number(sessionSummary?.unique_sessions ?? 0);
      const detailedMetrics = eventRows.rows.map((row) => ({ event_name: String(row.event_name), total: Number(row.total) }));
      const pageViewSessions = detailedMetrics.find((metric) => metric.event_name === "page_view")?.total ?? 0;
      instrumentedAt = sessionSummary?.instrumented_at ? String(sessionSummary.instrumented_at) : null;
      if (uniqueSessions >= minimumSessionSample && pageViewSessions >= minimumSessionSample) {
        mode = "sessions";
        metrics = detailedMetrics;
        engagedSessions = Number(sessionSummary?.engaged_sessions ?? 0);
        totalInteractions = Number(sessionSummary?.interactions ?? 0);
        if (instrumentedAt) approvedPayments = await getApprovedPaymentsSince(instrumentedAt);
        busyHours = hourRows.rows.map((row) => ({ hour: Number(row.hour), total: Number(row.total) }));
        devices = deviceRows.rows.map((row) => ({ device: String(row.device), total: Number(row.total) }));
        topPaths = pathRows.rows.map((row) => ({ path: String(row.path), total: Number(row.total) }));
      }
    }

    if (mode === "aggregate") {
      const hourRows = await db.execute(sql`
        SELECT ((event_hour + 3) % 24)::int AS hour, SUM(count)::int AS total
        FROM funnel_events
        WHERE event_name = 'page_view'
          AND event_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date - (${days}::int * INTERVAL '1 day')
        GROUP BY event_hour ORDER BY total DESC LIMIT 4
      `);
      busyHours = hourRows.rows.map((row) => ({ hour: Number(row.hour), total: Number(row.total) }));
    }

    const funnel = buildBehaviorFunnel(metrics, approvedPayments, mode);
    return {
      periodDays: days,
      mode,
      instrumentedAt,
      uniqueSessions,
      minimumSessionSample,
      engagedSessions,
      totalInteractions,
      funnel,
      rates: buildBehaviorRates(funnel),
      insights: buildBehaviorInsights(funnel, mode, engagedSessions, uniqueSessions),
      busyHours,
      devices,
      topPaths,
      trafficTrend,
    };
  } catch (error) {
    console.error("Failed to build behavior analytics:", error);
    return empty;
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

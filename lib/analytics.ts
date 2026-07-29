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

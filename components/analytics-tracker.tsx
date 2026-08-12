"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

let volatileSessionId = "";

function getSessionId() {
  const key = "masarak-analytics-session";
  try {
    const current = window.sessionStorage.getItem(key);
    if (current) return current;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    if (!volatileSessionId) volatileSessionId = crypto.randomUUID();
    return volatileSessionId;
  }
}

function sendFunnel(name: string, metadata?: Record<string, unknown>) {
  fetch("/api/analytics/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, metadata, sessionId: getSessionId() }),
    keepalive: true,
  }).catch(() => {});
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", path: pathname }),
    }).catch(() => {});
    sendFunnel("page_view", { path: pathname });
    const engagedTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        sendFunnel("engaged_view", { path: pathname });
      }
    }, 15_000);
    return () => window.clearTimeout(engagedTimer);
  }, [pathname]);

  return null;
}

export function useTrackFunnel() {
  return useCallback((name: string, metadata?: Record<string, unknown>) => {
    sendFunnel(name, metadata);
  }, []);
}

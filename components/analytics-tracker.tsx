"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

function sendFunnel(name: string, metadata?: Record<string, unknown>) {
  fetch("/api/analytics/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, metadata }),
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
  }, [pathname]);

  return null;
}

export function useTrackFunnel() {
  return useCallback((name: string, metadata?: Record<string, unknown>) => {
    sendFunnel(name, metadata);
  }, []);
}

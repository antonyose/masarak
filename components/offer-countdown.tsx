"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatOfferCountdown, getServerBasedNow } from "@/lib/offer-config";

export function OfferCountdown({
  endAt,
  serverNow,
  receivedAt,
  compact = false,
  className = "",
}: {
  endAt: string | null;
  serverNow?: string | null;
  receivedAt?: number;
  compact?: boolean;
  className?: string;
}) {
  const [mountedAt] = useState(() => Date.now());
  const referenceAt = receivedAt ?? mountedAt;
  const [now, setNow] = useState(() => getServerBasedNow(serverNow, referenceAt));

  useEffect(() => {
    if (!endAt) return;
    const timer = window.setInterval(() => setNow(getServerBasedNow(serverNow, referenceAt)), 1000);
    return () => window.clearInterval(timer);
  }, [endAt, referenceAt, serverNow]);

  const countdown = formatOfferCountdown(endAt, now, compact);
  if (!countdown || Date.parse(endAt ?? "") <= now) return null;

  return (
    <span className={`offer-countdown-shared ${className}`.trim()}>
      <Clock3 size={compact ? 13 : 14} aria-hidden="true" />
      <span>{compact ? "ينتهي خلال" : "ينتهي خلال"}</span>
      <bdi>{countdown}</bdi>
    </span>
  );
}

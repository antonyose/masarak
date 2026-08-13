import React from "react";

export type SignalLevel = "green" | "yellow" | "orange" | "red" | "safe" | "target" | "reach" | "unlikely" | "insufficient_data";

export interface SignalIndicatorProps {
  fit: SignalLevel;
  customLabel?: string;
  className?: string;
  showBars?: boolean;
}

const SIGNAL_CONFIG: Record<
  SignalLevel,
  {
    activeBars: number;
    defaultLabel: string;
    levelClass: string;
    ariaDescription: string;
  }
> = {
  green: {
    activeBars: 4,
    defaultLabel: "فرصة مرتفعة جدًا",
    levelClass: "signal-green",
    ariaDescription: "فرصة قبول ممتازة 4 من 4",
  },
  safe: {
    activeBars: 4,
    defaultLabel: "فرصة مرتفعة جدًا",
    levelClass: "signal-green",
    ariaDescription: "فرصة قبول ممتازة 4 من 4",
  },
  yellow: {
    activeBars: 3,
    defaultLabel: "فرصة قوية ومناسبة",
    levelClass: "signal-yellow",
    ariaDescription: "فرصة قبول قوية 3 من 4",
  },
  target: {
    activeBars: 3,
    defaultLabel: "فرصة قوية ومناسبة",
    levelClass: "signal-yellow",
    ariaDescription: "فرصة قبول قوية 3 من 4",
  },
  orange: {
    activeBars: 2,
    defaultLabel: "فرصة منافسة (طموحة)",
    levelClass: "signal-orange",
    ariaDescription: "فرصة منافسة 2 من 4",
  },
  reach: {
    activeBars: 2,
    defaultLabel: "فرصة منافسة (طموحة)",
    levelClass: "signal-orange",
    ariaDescription: "فرصة منافسة 2 من 4",
  },
  red: {
    activeBars: 1,
    defaultLabel: "فرصة محدودة",
    levelClass: "signal-red",
    ariaDescription: "فرصة محدودة 1 من 4",
  },
  unlikely: {
    activeBars: 1,
    defaultLabel: "فرصة محدودة",
    levelClass: "signal-red",
    ariaDescription: "فرصة محدودة 1 من 4",
  },
  insufficient_data: {
    activeBars: 1,
    defaultLabel: "بيانات محدودة",
    levelClass: "signal-orange",
    ariaDescription: "بيانات محدودة",
  },
};

export function SignalIndicator({
  fit,
  customLabel,
  className = "",
  showBars = true,
}: SignalIndicatorProps) {
  const config = SIGNAL_CONFIG[fit] ?? SIGNAL_CONFIG.yellow;
  const label = customLabel || config.defaultLabel;

  return (
    <div
      className={`signal-indicator ${config.levelClass} ${className}`}
      role="status"
      aria-label={`${label} — ${config.ariaDescription}`}
    >
      {showBars && (
        <span className="signal-bars" aria-hidden="true">
          <span className={`signal-bar bar-1 ${config.activeBars >= 1 ? "is-active" : ""}`} />
          <span className={`signal-bar bar-2 ${config.activeBars >= 2 ? "is-active" : ""}`} />
          <span className={`signal-bar bar-3 ${config.activeBars >= 3 ? "is-active" : ""}`} />
          <span className={`signal-bar bar-4 ${config.activeBars >= 4 ? "is-active" : ""}`} />
        </span>
      )}
      <span className="signal-label">{label}</span>
    </div>
  );
}

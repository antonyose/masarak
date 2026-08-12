"use client";

import { useEffect, useState } from "react";

type Props = {
  data: Array<{ date: string; views: number; searches: number; predictions: number }>;
};

export function AdminDailyChart({ data }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  if (!data.length) {
    return <div className="admin-chart-empty">لا توجد بيانات كافية للرسم البياني</div>;
  }

  const maxVal = Math.max(...data.map((d) => d.views + d.searches + d.predictions), 1);
  const W = 700;
  const H = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barGroupW = chartW / data.length;
  const barW = Math.max(Math.min(barGroupW * 0.25, 16), 4);
  const gap = Math.max(barW * 0.15, 1);

  const gridLines = 4;
  const gridStep = maxVal / gridLines;

  function yPos(val: number) {
    return padT + chartH - (val / maxVal) * chartH;
  }

  return (
    <div className="admin-chart-wrap">
      <div className="admin-chart-legend">
        <span className="admin-legend-dot" style={{ background: "var(--teal-600, #0d9488)" }} />
        <span>مشاهدات</span>
        <span className="admin-legend-dot" style={{ background: "var(--amber-500, #f59e0b)" }} />
        <span>بحث</span>
        <span className="admin-legend-dot" style={{ background: "var(--indigo-500, #6366f1)" }} />
        <span>توقعات</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="admin-chart-svg"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const val = Math.round(gridStep * i);
          const y = yPos(val);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={10}>
                {val}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const cx = padL + barGroupW * i + barGroupW / 2;
          const x1 = cx - barW - gap / 2;
          const x2 = cx - gap / 2;
          const x3 = cx + gap / 2;
          const dateLabel = d.date.slice(5); // MM-DD
          return (
            <g
              key={d.date}
              onMouseEnter={(e) => {
                const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 12,
                  content: `${d.date}\nمشاهدات: ${d.views}\nبحث: ${d.searches}\nتوقعات: ${d.predictions}`,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Views bar */}
              <rect
                x={x1}
                y={yPos(d.views)}
                width={barW}
                height={Math.max((d.views / maxVal) * chartH, 1)}
                rx={2}
                fill="#0d9488"
                opacity={0.85}
              />
              {/* Searches bar */}
              <rect
                x={x2}
                y={yPos(d.searches)}
                width={barW}
                height={Math.max((d.searches / maxVal) * chartH, 1)}
                rx={2}
                fill="#f59e0b"
                opacity={0.85}
              />
              {/* Predictions bar */}
              <rect
                x={x3}
                y={yPos(d.predictions)}
                width={barW}
                height={Math.max((d.predictions / maxVal) * chartH, 1)}
                rx={2}
                fill="#6366f1"
                opacity={0.85}
              />
              {/* Date label */}
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={9}
                transform={data.length > 14 ? `rotate(-45 ${cx} ${H - 6})` : ""}
              >
                {dateLabel}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="admin-chart-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content.split("\n").map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

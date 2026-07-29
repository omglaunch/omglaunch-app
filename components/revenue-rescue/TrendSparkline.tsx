'use client';

import {
  buildPolyline,
  clicksToY,
  dayToX,
  RR_SPARK_HEIGHT,
  RR_SPARK_WIDTH,
} from '@/lib/revenue-rescue/sparkline';
import type { RevenueRescueRow } from '@/lib/revenue-rescue/types';

const STROKE_NEGATIVE = '#ef4444';
const STROKE_NEGATIVE_SOFT = '#f97316';
const STROKE_POSITIVE = '#10b981';

export default function TrendSparkline({ row }: { row: RevenueRescueRow }) {
  const { trend, coreUpdateDay, fixDay, coreUpdateLabel, trafficDeltaPct } =
    row;
  if (!trend.length) {
    return (
      <div className="h-10 w-[140px] animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    );
  }

  const max = Math.max(
    ...trend.map((p) => Math.max(p.clicks, p.benchmark)),
    1
  );
  const clicksLine = buildPolyline(trend, 'clicks');
  const benchLine = buildPolyline(trend, 'benchmark');

  // Bind stroke to traffic delta — never green on a negative drop
  const stroke =
    trafficDeltaPct < 0
      ? trafficDeltaPct <= -50
        ? STROKE_NEGATIVE
        : STROKE_NEGATIVE_SOFT
      : STROKE_POSITIVE;

  const coreX =
    coreUpdateDay != null ? dayToX(coreUpdateDay, trend.length) : null;
  const fixX =
    fixDay != null && trend[fixDay]
      ? dayToX(fixDay, trend.length)
      : null;
  const fixY =
    fixDay != null && trend[fixDay]
      ? clicksToY(trend[fixDay]!.clicks, max)
      : null;

  return (
    <svg
      width={RR_SPARK_WIDTH}
      height={RR_SPARK_HEIGHT}
      viewBox={`0 0 ${RR_SPARK_WIDTH} ${RR_SPARK_HEIGHT}`}
      className="overflow-visible"
      role="img"
      aria-label={`90-day click trend for ${row.targetKeyword}, ${trafficDeltaPct}%`}
    >
      <polyline
        fill="none"
        stroke="#a1a1aa"
        strokeWidth={1}
        strokeDasharray="3 3"
        strokeOpacity={0.7}
        points={benchLine}
      />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={clicksLine}
      />
      {coreX != null ? (
        <g>
          <title>
            {coreUpdateLabel ?? 'Google Core Update'}
          </title>
          <line
            x1={coreX}
            y1={2}
            x2={coreX}
            y2={RR_SPARK_HEIGHT - 2}
            stroke="#f59e0b"
            strokeWidth={1.25}
            strokeOpacity={0.9}
          >
            <title>
              {coreUpdateLabel ?? 'Google Core Update'}
            </title>
          </line>
          {/* Wider invisible hit target for hover */}
          <rect
            x={coreX - 4}
            y={0}
            width={8}
            height={RR_SPARK_HEIGHT}
            fill="transparent"
          >
            <title>
              {coreUpdateLabel ?? 'Google Core Update'}
            </title>
          </rect>
        </g>
      ) : null}
      {fixX != null && fixY != null ? (
        <g>
          <title>Optimization Fix Date</title>
          <polygon
            points={diamondPoints(fixX, fixY)}
            fill="#34d399"
            stroke="#059669"
            strokeWidth={0.75}
          >
            <title>Optimization Fix Date</title>
          </polygon>
          <circle
            cx={fixX}
            cy={fixY}
            r={7}
            fill="transparent"
          >
            <title>Optimization Fix Date</title>
          </circle>
        </g>
      ) : null}
    </svg>
  );
}

function diamondPoints(cx: number, cy: number, size = 3.5): string {
  return `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;
}

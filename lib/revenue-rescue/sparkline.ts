import type { TrendPoint } from '@/lib/revenue-rescue/types';

export const RR_SPARK_WIDTH = 140;
export const RR_SPARK_HEIGHT = 40;

export function clicksToY(
  clicks: number,
  maxClicks: number,
  height = RR_SPARK_HEIGHT
): number {
  const padding = 4;
  const usable = height - padding * 2;
  const ratio = maxClicks > 0 ? clicks / maxClicks : 0;
  return padding + usable - ratio * usable;
}

export function buildPolyline(
  points: TrendPoint[],
  key: 'clicks' | 'benchmark',
  width = RR_SPARK_WIDTH,
  height = RR_SPARK_HEIGHT
): string {
  if (!points.length) return '';
  const max = Math.max(
    ...points.map((p) => Math.max(p.clicks, p.benchmark)),
    1
  );
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points
    .map((p, i) => `${i * step},${clicksToY(p[key], max, height)}`)
    .join(' ');
}

export function dayToX(
  day: number,
  totalDays: number,
  width = RR_SPARK_WIDTH
): number {
  if (totalDays <= 1) return 0;
  return (day / (totalDays - 1)) * width;
}

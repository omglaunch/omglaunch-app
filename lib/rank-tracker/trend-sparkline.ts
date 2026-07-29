import {
  UNRANKED_POSITION,
  type RankTrackerHistoryEntry,
} from '@/lib/rank-tracker/types';

export const TREND_SPARKLINE_WIDTH = 96;
export const TREND_SPARKLINE_HEIGHT = 32;
export const TREND_CHART_RANK_FLOOR = 100;

export const TREND_STROKE_IMPROVED = '#10b981';
export const TREND_STROKE_DECLINED = '#ef4444';
export const TREND_STROKE_FLAT = '#d1d5db';

export type TrendSparklinePoint = {
  rank: number;
  index: number;
  checkedAt: string;
};

/** Map SERP rank to chart Y — rank 1 plots high, rank 100/unranked plots low. */
export function normalizeRankForTrendChart(
  rank: number | null | undefined
): number {
  if (rank == null || rank <= 0 || rank > TREND_CHART_RANK_FLOOR) {
    return TREND_CHART_RANK_FLOOR;
  }
  return rank;
}

export function rankToTrendChartY(
  rank: number,
  height = TREND_SPARKLINE_HEIGHT
): number {
  const normalized = normalizeRankForTrendChart(rank);
  const inverted = TREND_CHART_RANK_FLOOR - normalized;
  const maxInverted = TREND_CHART_RANK_FLOOR - 1;
  const padding = 4;
  const usable = height - padding * 2;
  return padding + usable - (inverted / maxInverted) * usable;
}

function subtractOneDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  date.setDate(date.getDate() - 1);
  return date.toISOString();
}

/** Oldest → newest; single-point history is duplicated with an earlier timestamp. */
export function prepareTrendSparklinePoints(
  history: RankTrackerHistoryEntry[] | null | undefined
): TrendSparklinePoint[] {
  if (!history?.length) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
  );

  let points: TrendSparklinePoint[] = sorted.map((entry, index) => ({
    rank: normalizeRankForTrendChart(entry.position),
    index,
    checkedAt: entry.checkedAt,
  }));

  if (points.length === 1) {
    const only = points[0];
    points = [
      {
        rank: only.rank,
        index: 0,
        checkedAt: subtractOneDay(only.checkedAt),
      },
      {
        rank: only.rank,
        index: 1,
        checkedAt: only.checkedAt,
      },
    ];
  }

  return points;
}

export function resolveTrendStrokeColor(points: TrendSparklinePoint[]): string {
  if (points.length < 2) return TREND_STROKE_FLAT;

  const firstRank = points[0].rank;
  const lastRank = points[points.length - 1].rank;

  if (firstRank === lastRank) return TREND_STROKE_FLAT;
  if (lastRank < firstRank) return TREND_STROKE_IMPROVED;
  return TREND_STROKE_DECLINED;
}

export function buildTrendSparklinePolyline(
  points: TrendSparklinePoint[],
  width = TREND_SPARKLINE_WIDTH,
  height = TREND_SPARKLINE_HEIGHT
): string {
  if (points.length === 0) return '';

  const xStep = points.length > 1 ? width / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = index * xStep;
      const y = rankToTrendChartY(point.rank, height);
      return `${x},${y}`;
    })
    .join(' ');
}

export function formatTrendAriaLabel(points: TrendSparklinePoint[]): string {
  if (points.length === 0) return 'No rank history';
  const first = points[0].rank;
  const last = points[points.length - 1].rank;
  if (first === last) {
    return `Rank stable at position ${last >= UNRANKED_POSITION ? '100+' : last}`;
  }
  if (last < first) {
    return `Rank improved from ${first} to ${last}`;
  }
  return `Rank declined from ${first} to ${last}`;
}

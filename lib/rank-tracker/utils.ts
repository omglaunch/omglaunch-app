import {
  UNRANKED_POSITION,
  type RankTrackerHistoryEntry,
  type RankTrackerKeywordRow,
} from '@/lib/rank-tracker/types';
import { normalizeUrlForComparison } from '@/lib/rank-tracker/url-normalize';

/** @deprecated Use normalizeUrlForComparison from url-normalize.ts */
export function normalizeUrl(url: string): string {
  return normalizeUrlForComparison(url);
}

export function isCannibalization(
  targetUrl: string | null,
  urlFound: string
): boolean {
  if (!targetUrl?.trim() || !urlFound.trim()) return false;
  return normalizeUrlForComparison(targetUrl) !== normalizeUrlForComparison(urlFound);
}

export function resolveDisplayHistory(
  row: RankTrackerKeywordRow
): RankTrackerHistoryEntry | null {
  if (row.latestHistory) return row.latestHistory;

  if (row.currentRank == null) return null;

  return {
    id: `snapshot-${row.id}`,
    savedKeywordId: row.id,
    position: row.currentRank,
    previousPosition: row.currentRank,
    urlFound: row.rankedUrl ?? '',
    rankedUrl: row.rankedUrl ?? '',
    competingPages: row.competingPages,
    isFeaturedSnippet: false,
    isLocalPack: false,
    serpFeaturesFound: [],
    competitorRankings: {},
    checkedAt: row.createdAt,
  };
}

export function formatRankDisplay(
  latestHistory: RankTrackerHistoryEntry | null,
  currentRank?: number | null
): string {
  if (latestHistory) {
    if (latestHistory.position >= UNRANKED_POSITION) return '>100';
    return String(latestHistory.position);
  }

  if (currentRank == null) return 'Pending...';
  if (currentRank >= UNRANKED_POSITION) return '>100';
  return String(currentRank);
}

export function rankDelta(
  latestHistory: RankTrackerHistoryEntry | null
): number | null {
  if (!latestHistory) return null;
  if (
    latestHistory.position >= UNRANKED_POSITION &&
    latestHistory.previousPosition >= UNRANKED_POSITION
  ) {
    return 0;
  }
  return latestHistory.previousPosition - latestHistory.position;
}

/** Page-1 visibility share based on currentRank across all active keywords. */
export function computeVisibilityScore(rows: RankTrackerKeywordRow[]): number {
  const active = rows.filter(row => row.isActive);
  if (active.length === 0) return 0;

  const hasAnyRank = active.some(row => row.currentRank != null);
  if (!hasAnyRank) return 0;

  const pageOne = active.filter(
    row => row.currentRank != null && row.currentRank <= 10
  ).length;

  return Math.round((pageOne / active.length) * 100);
}

export function computeAverageRank(rows: RankTrackerKeywordRow[]): string {
  const ranked = rows.filter(row => row.isActive && row.currentRank != null);
  if (ranked.length === 0) return '—';

  const avg =
    ranked.reduce((sum, row) => sum + row.currentRank!, 0) / ranked.length;
  return avg.toFixed(1);
}

export function computeTop3Count(rows: RankTrackerKeywordRow[]): number {
  return rows.filter(
    row =>
      row.isActive &&
      row.currentRank != null &&
      row.currentRank >= 1 &&
      row.currentRank <= 3
  ).length;
}

export function truncateUrl(url: string, max = 42): string {
  const normalized = normalizeUrlForComparison(url);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

export function resolvePositionSortValue(row: RankTrackerKeywordRow): number {
  if (row.latestHistory?.position != null) {
    return row.latestHistory.position;
  }
  if (row.currentRank != null) {
    return row.currentRank;
  }
  return 999;
}

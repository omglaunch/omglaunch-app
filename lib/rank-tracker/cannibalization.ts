import { normalizeUrlForComparison } from '@/lib/rank-tracker/url-normalize';

export type CompetingPage = {
  url: string;
  rank: number;
};

export type CannibalizationThreatLevel = 'high' | 'medium' | 'low';

export function parseCompetingPagesJson(
  value: string | null | undefined
): CompetingPage[] | null {
  if (!value?.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const pages = parsed
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as { url?: unknown; rank?: unknown };
        const url = typeof record.url === 'string' ? record.url.trim() : '';
        const rank =
          typeof record.rank === 'number' && Number.isFinite(record.rank)
            ? Math.trunc(record.rank)
            : null;
        if (!url || rank == null || rank <= 0) return null;
        return { url, rank };
      })
      .filter((entry): entry is CompetingPage => entry !== null);

    return pages.length > 0 ? pages : null;
  } catch {
    return null;
  }
}

export function stringifyCompetingPages(
  pages: CompetingPage[] | null | undefined
): string | null {
  if (!pages?.length) return null;
  return JSON.stringify(pages);
}

export function resolveCannibalizationThreatLevel(
  primaryRank: number,
  competingRank: number
): CannibalizationThreatLevel {
  const distance = Math.abs(competingRank - primaryRank);
  if (distance <= 10) return 'high';
  if (distance <= 25) return 'medium';
  return 'low';
}

export function isIntentMismatch(
  targetUrl: string | null | undefined,
  rankedUrl: string | null | undefined,
  currentRank: number | null | undefined
): boolean {
  if (currentRank == null || currentRank <= 0) return false;
  if (!targetUrl?.trim() || !rankedUrl?.trim()) return false;
  return (
    normalizeUrlForComparison(targetUrl) !== normalizeUrlForComparison(rankedUrl)
  );
}

export const THREAT_LEVEL_STYLES: Record<
  CannibalizationThreatLevel,
  { dot: string; label: string; text: string }
> = {
  high: {
    dot: '🔴',
    label: 'High Threat',
    text: 'text-red-600 dark:text-red-400',
  },
  medium: {
    dot: '🟠',
    label: 'Medium Threat',
    text: 'text-orange-600 dark:text-orange-400',
  },
  low: {
    dot: '🟡',
    label: 'Low Threat',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

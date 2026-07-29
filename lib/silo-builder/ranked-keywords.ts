import type { RankedKeywordRow } from '@/lib/silo-builder/dataforseo-ranked';

export const SILO_RANKED_KEYWORDS_PERSIST_LIMIT = 100;

export function sliceRankedKeywordsForPersist(
  rows: RankedKeywordRow[]
): RankedKeywordRow[] {
  return rows.slice(0, SILO_RANKED_KEYWORDS_PERSIST_LIMIT);
}

export function parseRankedKeywords(value: unknown): RankedKeywordRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is RankedKeywordRow =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as RankedKeywordRow).keyword === 'string' &&
      ((item as RankedKeywordRow).searchVolume === null ||
        typeof (item as RankedKeywordRow).searchVolume === 'number') &&
      ((item as RankedKeywordRow).rank === null ||
        typeof (item as RankedKeywordRow).rank === 'number')
  );
}

import type { RankedKeywordRow } from '@/lib/silo-builder/dataforseo-ranked';
import type { SiloKeywordSource } from '@/lib/silo-builder/metrics-confidence';

const FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'guide',
  'how',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'selection',
  'essentials',
  'tools',
  'solutions',
  'strategies',
  'comprehensive',
  'ultimate',
  'best',
  'properly',
  'choosing',
  'select',
]);

const PHRASE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bhiking backpack selection\b/i, replacement: 'hiking backpack' },
  { pattern: /\bhiking apparel\b/i, replacement: 'hiking clothes' },
  { pattern: /\bhiking boots\b/i, replacement: 'hiking shoes' },
  { pattern: /\bhiking tents\b/i, replacement: 'camping tent' },
  { pattern: /\bhiking navigation tools\b/i, replacement: 'hiking compass' },
  { pattern: /\bwater purification\b/i, replacement: 'water filter' },
];

export type CanonicalKeywordResolution = {
  keyword: string;
  originalKeyword: string;
  keywordSource: SiloKeywordSource;
  keywordChanged: boolean;
};

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokenize(value: string): string[] {
  return normalizeKeyword(value)
    .split(/[^a-z0-9]+/i)
    .map(token => token.trim())
    .filter(token => token.length > 2 && !FILLER_WORDS.has(token));
}

function applyPhraseReplacements(keyword: string): string {
  let next = keyword.trim();

  for (const { pattern, replacement } of PHRASE_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }

  return next.replace(/\s+/g, ' ').trim();
}

function overlapScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of Array.from(leftTokens)) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function isBrandedCompetitorKeyword(keyword: string): boolean {
  return /\bdecathlon\b/i.test(keyword);
}

function findExactCompetitorMatch(
  keyword: string,
  competitorKeywords: RankedKeywordRow[]
): RankedKeywordRow | null {
  const normalized = normalizeKeyword(keyword);

  return (
    competitorKeywords.find(
      row => normalizeKeyword(row.keyword) === normalized
    ) ?? null
  );
}

function findBestCompetitorMatch(
  keyword: string,
  competitorKeywords: RankedKeywordRow[]
): RankedKeywordRow | null {
  const candidates = competitorKeywords.filter(
    row => !isBrandedCompetitorKeyword(row.keyword)
  );

  let best: { row: RankedKeywordRow; score: number } | null = null;

  for (const row of candidates) {
    const overlap = overlapScore(keyword, row.keyword);
    if (overlap < 0.45) {
      continue;
    }

    const volumeBoost = Math.log10(Math.max(row.searchVolume ?? 1, 1)) / 10;
    const score = overlap + volumeBoost;

    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  return best?.row ?? null;
}

export function resolveCanonicalKeyword(
  rawKeyword: string,
  competitorKeywords: RankedKeywordRow[] = []
): CanonicalKeywordResolution {
  const originalKeyword = rawKeyword.trim();
  const normalizedOriginal = normalizeKeyword(originalKeyword);

  const exactCompetitor = findExactCompetitorMatch(
    originalKeyword,
    competitorKeywords
  );
  if (exactCompetitor) {
    return {
      keyword: exactCompetitor.keyword,
      originalKeyword,
      keywordSource: 'competitor',
      keywordChanged: normalizeKeyword(exactCompetitor.keyword) !== normalizedOriginal,
    };
  }

  const replaced = applyPhraseReplacements(originalKeyword);
  if (normalizeKeyword(replaced) !== normalizedOriginal) {
    const replacedCompetitor = findExactCompetitorMatch(replaced, competitorKeywords);
    if (replacedCompetitor) {
      return {
        keyword: replacedCompetitor.keyword,
        originalKeyword,
        keywordSource: 'competitor',
        keywordChanged: true,
      };
    }

    const replacedOverlap = findBestCompetitorMatch(replaced, competitorKeywords);
    if (replacedOverlap && overlapScore(replaced, replacedOverlap.keyword) >= 0.55) {
      return {
        keyword: replacedOverlap.keyword,
        originalKeyword,
        keywordSource: 'competitor',
        keywordChanged: true,
      };
    }

    return {
      keyword: replaced,
      originalKeyword,
      keywordSource: 'resolved',
      keywordChanged: true,
    };
  }

  const overlapMatch = findBestCompetitorMatch(originalKeyword, competitorKeywords);
  if (overlapMatch && overlapScore(originalKeyword, overlapMatch.keyword) >= 0.6) {
    return {
      keyword: overlapMatch.keyword,
      originalKeyword,
      keywordSource: 'competitor',
      keywordChanged: normalizeKeyword(overlapMatch.keyword) !== normalizedOriginal,
    };
  }

  return {
    keyword: originalKeyword,
    originalKeyword,
    keywordSource: 'gemini',
    keywordChanged: false,
  };
}

export function resolveCanonicalKeywords(
  keywords: string[],
  competitorKeywords: RankedKeywordRow[] = []
): Map<string, CanonicalKeywordResolution> {
  const results = new Map<string, CanonicalKeywordResolution>();

  for (const keyword of keywords) {
    if (!keyword.trim()) {
      continue;
    }

    results.set(keyword, resolveCanonicalKeyword(keyword, competitorKeywords));
  }

  return results;
}

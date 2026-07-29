import type { TrustSignals } from '@/lib/competitor-compare-data';

export type CompareGeoScoreInput = {
  url: string;
  title: string;
  headings: string[];
  wordCount: number;
  headingCount: number;
  images: {
    total: number;
    missingAlt: number;
  };
  trustSignals: TrustSignals;
};

/**
 * Deterministic GEO score derived strictly from one page's scraped metrics.
 * Used for multi-competitor compare so each URL gets an isolated score.
 */
export function computeCompareGeoScore(
  metrics: CompareGeoScoreInput,
  targetKeyword: string
): number {
  let score = 8;

  const wordCount = metrics.wordCount;
  if (wordCount >= 5000) score += 28;
  else if (wordCount >= 2000) score += 24;
  else if (wordCount >= 1000) score += 20;
  else if (wordCount >= 500) score += 15;
  else if (wordCount >= 200) score += 10;
  else if (wordCount >= 50) score += 5;

  const headingCount = metrics.headingCount;
  if (headingCount >= 10) score += 12;
  else if (headingCount >= 5) score += 9;
  else if (headingCount >= 2) score += 5;
  else if (headingCount >= 1) score += 2;

  if (metrics.images.total > 0) {
    const altCoverage =
      (metrics.images.total - metrics.images.missingAlt) / metrics.images.total;
    score += Math.round(altCoverage * 10);
  }

  const { outboundLinks, quotes, statistics } = metrics.trustSignals;
  score += Math.min(6, Math.floor(outboundLinks / 3));
  score += Math.min(4, statistics);
  score += Math.min(3, quotes * 2);

  const keyword = targetKeyword.trim().toLowerCase();
  if (keyword) {
    if (metrics.title.toLowerCase().includes(keyword)) score += 8;
    if (metrics.headings.some(heading => heading.toLowerCase().includes(keyword))) score += 6;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function buildCompareGeoScoreInput(input: {
  url: string;
  title: string;
  headings: string[];
  wordCount: number;
  headingCount: number;
  images: { total: number; missingAlt: number };
  trustSignals: TrustSignals;
}): CompareGeoScoreInput {
  return {
    url: input.url,
    title: input.title,
    headings: [...input.headings],
    wordCount: input.wordCount,
    headingCount: input.headingCount,
    images: {
      total: input.images.total,
      missingAlt: input.images.missingAlt,
    },
    trustSignals: {
      outboundLinks: input.trustSignals.outboundLinks,
      quotes: input.trustSignals.quotes,
      statistics: input.trustSignals.statistics,
    },
  };
}

import { normalizeUrlForComparison } from '@/lib/rank-tracker/url-normalize';
import type { CompetingPage } from '@/lib/rank-tracker/cannibalization';
import { UNRANKED_POSITION } from '@/lib/rank-tracker/types';

export type SerpItem = {
  type?: string;
  rank_absolute?: number;
  rank_group?: number;
  url?: string;
  domain?: string;
  items?: SerpItem[];
};

const FEATURE_LABELS: Record<string, string> = {
  featured_snippet: 'Featured Snippet',
  local_pack: 'Local Pack',
  people_also_ask: 'People Also Ask',
  video: 'Video',
  images: 'Images',
  knowledge_graph: 'Knowledge Graph',
  twitter: 'Twitter',
  map: 'Maps',
  paid: 'Paid',
  shopping: 'Shopping',
};

const RANKABLE_TYPES = new Set(['organic', 'featured_snippet']);

export type SerpParseResult = {
  position: number;
  urlFound: string;
  rankedUrl: string;
  competingPages: CompetingPage[] | null;
  isFeaturedSnippet: boolean;
  isLocalPack: boolean;
  serpFeaturesFound: string[];
  competitorRankings: Record<string, number>;
};

export type DomainRankingExtraction = {
  primary: CompetingPage | null;
  competingPages: CompetingPage[] | null;
  isFeaturedSnippet: boolean;
};

function extractHostname(urlOrDomain: string): string {
  const trimmed = urlOrDomain.trim();
  if (!trimmed) return '';

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return normalizeUrlForComparison(new URL(withProtocol).hostname);
  } catch {
    return normalizeUrlForComparison(trimmed.split('/')[0] ?? trimmed);
  }
}

export function extractDomain(urlOrDomain: string): string {
  return extractHostname(urlOrDomain);
}

function isRankableSerpItem(item: SerpItem): boolean {
  const type = item.type?.toLowerCase() ?? '';
  return RANKABLE_TYPES.has(type);
}

function organicRankGroup(item: SerpItem): number | null {
  if (typeof item.rank_group !== 'number' || item.rank_group <= 0) {
    return null;
  }
  return Math.trunc(item.rank_group);
}

function featureLabel(type: string | undefined): string | null {
  if (!type) return null;
  return FEATURE_LABELS[type] ?? null;
}

function itemMatchesDomain(item: SerpItem, targetDomain: string): boolean {
  if (!targetDomain || !item.url?.trim()) return false;

  const itemDomain = extractHostname(item.url);
  const fromDomain = item.domain ? extractHostname(item.domain) : '';

  return itemDomain === targetDomain || fromDomain === targetDomain;
}

function collectRankableItems(items: SerpItem[]): SerpItem[] {
  const collected: SerpItem[] = [];

  for (const item of items) {
    if (isRankableSerpItem(item)) {
      collected.push(item);
    }
    if (Array.isArray(item.items)) {
      collected.push(...collectRankableItems(item.items));
    }
  }

  return collected;
}

function collectFeatureLabels(items: SerpItem[]): string[] {
  const labels = new Set<string>();

  function walk(list: SerpItem[]) {
    for (const item of list) {
      const label = featureLabel(item.type);
      if (label) labels.add(label);
      if (Array.isArray(item.items)) walk(item.items);
    }
  }

  walk(items);
  return Array.from(labels);
}

/** Extract, normalize, dedupe, and rank all domain matches from organic + featured_snippet items. */
export function extractDomainRankings(
  items: SerpItem[],
  targetDomain: string
): DomainRankingExtraction {
  const normalizedTargetDomain = extractDomain(targetDomain);
  if (!normalizedTargetDomain) {
    return { primary: null, competingPages: null, isFeaturedSnippet: false };
  }

  const rankableItems = collectRankableItems(items);
  const bestByNormalizedUrl = new Map<
    string,
    { url: string; rank: number; isFeaturedSnippet: boolean }
  >();

  for (const item of rankableItems) {
    if (!itemMatchesDomain(item, normalizedTargetDomain)) continue;

    const rank = organicRankGroup(item);
    const originalUrl = item.url?.trim();
    if (rank == null || !originalUrl) continue;

    const normalizedUrl = normalizeUrlForComparison(originalUrl);
    if (!normalizedUrl) continue;

    const isFeaturedSnippet = item.type?.toLowerCase() === 'featured_snippet';
    const existing = bestByNormalizedUrl.get(normalizedUrl);

    if (!existing || rank < existing.rank) {
      bestByNormalizedUrl.set(normalizedUrl, {
        url: originalUrl,
        rank,
        isFeaturedSnippet,
      });
    }
  }

  const uniqueMatches = Array.from(bestByNormalizedUrl.values()).sort(
    (a, b) => a.rank - b.rank
  );

  if (uniqueMatches.length === 0) {
    return { primary: null, competingPages: null, isFeaturedSnippet: false };
  }

  const primaryMatch = uniqueMatches[0];
  const competingPages =
    uniqueMatches.length > 1
      ? uniqueMatches.slice(1).map(match => ({ url: match.url, rank: match.rank }))
      : null;

  return {
    primary: { url: primaryMatch.url, rank: primaryMatch.rank },
    competingPages,
    isFeaturedSnippet: primaryMatch.isFeaturedSnippet,
  };
}

export function parseSerpForTarget(
  items: SerpItem[],
  targetDomain: string,
  competitorDomains: string[]
): SerpParseResult {
  const normalizedTargetDomain = extractDomain(targetDomain);
  const normalizedCompetitors = competitorDomains
    .map(domain => extractDomain(domain))
    .filter(Boolean);

  const domainRankings = extractDomainRankings(items, normalizedTargetDomain);
  const serpFeaturesFound = collectFeatureLabels(items);
  const competitorRankings: Record<string, number> = {};

  let isLocalPack = false;

  function walkForCompetitors(list: SerpItem[]) {
    for (const item of list) {
      if (item.type === 'local_pack') {
        if (itemMatchesDomain(item, normalizedTargetDomain)) {
          isLocalPack = true;
        }
      }

      if (item.type === 'organic' && item.url) {
        const itemDomain = extractHostname(item.url);
        const rank = organicRankGroup(item);
        if (rank == null) continue;

        for (const competitorDomain of normalizedCompetitors) {
          if (itemDomain === competitorDomain) {
            const existing = competitorRankings[competitorDomain];
            if (existing === undefined || rank < existing) {
              competitorRankings[competitorDomain] = rank;
            }
          }
        }
      }

      if (Array.isArray(item.items)) {
        walkForCompetitors(item.items);
      }
    }
  }

  walkForCompetitors(items);

  const primary = domainRankings.primary;
  const position = primary?.rank ?? UNRANKED_POSITION;
  const rankedUrl = primary?.url ?? '';

  return {
    position,
    urlFound: rankedUrl,
    rankedUrl,
    competingPages: domainRankings.competingPages,
    isFeaturedSnippet: domainRankings.isFeaturedSnippet,
    isLocalPack,
    serpFeaturesFound,
    competitorRankings,
  };
}

export function resolveTargetDomain(
  targetUrl: string | null | undefined,
  campaignDomain: string | null | undefined
): string {
  if (targetUrl?.trim()) {
    return extractDomain(targetUrl);
  }
  return extractDomain(campaignDomain ?? '');
}

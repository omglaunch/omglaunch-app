import {
  extractDomain,
  extractDomainRankings,
  type SerpItem,
} from '@/lib/rank-tracker/serp-parser';
import type { CompetingPage } from '@/lib/rank-tracker/cannibalization';

export type SerpHarvestResult = {
  currentRank: number;
  rankedUrl: string;
  competingPages: CompetingPage[] | null;
};

type SerpItemLike = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
  relative_url?: string;
  items?: SerpItemLike[];
};

function normalizeTargetDomain(domain: string | null | undefined): string {
  if (!domain?.trim()) return '';
  return extractDomain(domain);
}

function buildUrlFromItem(item: SerpItemLike): string {
  if (item.url?.trim()) return item.url.trim();
  if (item.relative_url?.trim() && item.domain?.trim()) {
    const path = item.relative_url.startsWith('/')
      ? item.relative_url
      : `/${item.relative_url}`;
    return `https://${item.domain.replace(/^www\./i, '')}${path}`;
  }
  if (item.domain?.trim()) {
    return `https://${item.domain.replace(/^www\./i, '')}`;
  }
  return '';
}

function toSerpItem(item: SerpItemLike): SerpItem {
  return {
    type: item.type,
    rank_group: item.rank_group,
    rank_absolute: item.rank_absolute,
    url: buildUrlFromItem(item) || item.url,
    domain: item.domain,
    items: item.items?.map(toSerpItem),
  };
}

function collectSerpItemsFromPayload(
  value: unknown,
  depth = 0,
  bucket: SerpItemLike[] = []
): SerpItemLike[] {
  if (depth > 8 || value == null) return bucket;

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSerpItemsFromPayload(entry, depth + 1, bucket);
    }
    return bucket;
  }

  if (typeof value !== 'object') return bucket;

  const record = value as Record<string, unknown>;

  if (record.type && (record.url || record.relative_url || record.domain)) {
    bucket.push(record as SerpItemLike);
  }

  if (record.ranked_serp_element && typeof record.ranked_serp_element === 'object') {
    const serpItem = (record.ranked_serp_element as { serp_item?: SerpItemLike })
      .serp_item;
    if (serpItem) bucket.push(serpItem);
  }

  if (Array.isArray(record.serp_items)) {
    bucket.push(...(record.serp_items as SerpItemLike[]));
  }

  if (record.serp_info && typeof record.serp_info === 'object') {
    const serpInfo = record.serp_info as Record<string, unknown>;
    if (Array.isArray(serpInfo.serp_items)) {
      bucket.push(...(serpInfo.serp_items as SerpItemLike[]));
    }
  }

  for (const nested of Object.values(record)) {
    if (nested === record.serp_items || nested === record.serp_info) continue;
    collectSerpItemsFromPayload(nested, depth + 1, bucket);
  }

  return bucket;
}

/** Zero-cost rank baseline from an embedded Labs SERP snapshot. */
export function harvestRankFromLabsPayload(
  payload: unknown,
  targetDomain: string | null | undefined
): SerpHarvestResult | null {
  const normalizedDomain = normalizeTargetDomain(targetDomain);
  if (!normalizedDomain || payload == null) return null;

  const rawItems = collectSerpItemsFromPayload(payload);
  if (rawItems.length === 0) return null;

  const serpItems = rawItems.map(toSerpItem);
  const extraction = extractDomainRankings(serpItems, normalizedDomain);

  if (!extraction.primary) return null;

  return {
    currentRank: extraction.primary.rank,
    rankedUrl: extraction.primary.url,
    competingPages: extraction.competingPages,
  };
}

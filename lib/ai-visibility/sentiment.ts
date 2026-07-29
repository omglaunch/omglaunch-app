/**
 * Entity-Targeted Sentiment Analysis (ABSA) cache.
 * Invalidation is tied to a cryptographic hash of the scraped text snippet.
 */

export type AbsaSentiment = 'positive' | 'neutral' | 'negative';

type CacheEntry = {
  sentiment: AbsaSentiment;
  snippetHash: string;
  entity: string;
  cachedAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedSentiment(
  entity: string,
  snippetHash: string
): AbsaSentiment | null {
  const key = `${entity}::${snippetHash}`;
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.snippetHash !== snippetHash) {
    cache.delete(key);
    return null;
  }
  return hit.sentiment;
}

export function setCachedSentiment(
  entity: string,
  snippetHash: string,
  sentiment: AbsaSentiment
) {
  cache.set(`${entity}::${snippetHash}`, {
    entity,
    snippetHash,
    sentiment,
    cachedAt: Date.now(),
  });
}

/** Lightweight ABSA stub — production calls NLP microservice. */
export function analyzeEntitySentiment(
  snippet: string,
  entity: string
): AbsaSentiment {
  const lower = snippet.toLowerCase();
  const neg = /overpromise|scam|worse|avoid|unreliable|negative|poor/.test(lower);
  const pos = /best|recommend|trusted|excellent|leading|reliable/.test(lower);
  if (neg && lower.includes(entity.toLowerCase().split(' ')[0] ?? entity)) {
    return 'negative';
  }
  if (pos) return 'positive';
  return 'neutral';
}

import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

const CACHE_TTL_DAYS = 30;

export type CacheEndpoint =
  | 'related_keywords'
  | 'related_questions'
  | 'serp_live'
  | 'keyword_ideas'
  | 'keyword_overview';

function keywordCacheClient() {
  const delegate = getPrisma().keywordCache;

  if (!delegate) {
    throw new Error(
      'Prisma client is missing the KeywordCache delegate. Run `npx prisma generate` and restart the dev server.'
    );
  }

  return delegate;
}

function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeSegment(value: string): string {
  return value.toLowerCase().trim();
}

export function generateQueryKey(
  endpointType: CacheEndpoint,
  keyword: string,
  location: string,
  language: string,
  device: string,
  searchEngine: string
): string {
  const payload = [
    endpointType,
    normalizeKeyword(keyword),
    normalizeSegment(location),
    normalizeSegment(language),
    normalizeSegment(device),
    normalizeSegment(searchEngine),
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

function buildExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);
  return expiresAt;
}

export async function getValidCache(
  endpointType: CacheEndpoint,
  keyword: string,
  location: string,
  language: string,
  device = 'desktop',
  searchEngine = 'google'
): Promise<Prisma.JsonValue | null> {
  try {
    const queryKey = generateQueryKey(
      endpointType,
      keyword,
      location,
      language,
      device,
      searchEngine
    );

    const cache = await keywordCacheClient().findUnique({
      where: { queryKey },
    });

    if (!cache || cache.expiresAt <= new Date()) {
      return null;
    }

    void keywordCacheClient()
      .update({
        where: { id: cache.id },
        data: { hitCount: { increment: 1 } },
      })
      .catch((error) => {
        console.error('[cacheService] Failed to increment hitCount:', error);
      });

    return cache.apiResponse;
  } catch (error) {
    console.error('[cacheService] getValidCache failed:', error);
    return null;
  }
}

export type CacheMetadata = {
  createdAt: Date;
  expiresAt: Date;
};

export async function getCacheMetadata(
  endpointType: CacheEndpoint,
  keyword: string,
  location: string,
  language: string,
  device = 'desktop',
  searchEngine = 'google'
): Promise<CacheMetadata | null> {
  try {
    const queryKey = generateQueryKey(
      endpointType,
      keyword,
      location,
      language,
      device,
      searchEngine
    );

    const cache = await keywordCacheClient().findUnique({
      where: { queryKey },
      select: { createdAt: true, expiresAt: true },
    });

    if (!cache || cache.expiresAt <= new Date()) {
      return null;
    }

    return cache;
  } catch (error) {
    console.error('[cacheService] getCacheMetadata failed:', error);
    return null;
  }
}

export async function setCache(
  endpointType: CacheEndpoint,
  keyword: string,
  location: string,
  language: string,
  apiResponse: Prisma.InputJsonValue,
  device = 'desktop',
  searchEngine = 'google'
): Promise<void> {
  const queryKey = generateQueryKey(
    endpointType,
    keyword,
    location,
    language,
    device,
    searchEngine
  );
  const normalizedKeyword = normalizeKeyword(keyword);
  const expiresAt = buildExpiresAt();

  await keywordCacheClient().upsert({
    where: { queryKey },
    create: {
      queryKey,
      keyword: normalizedKeyword,
      location: normalizeSegment(location),
      language: normalizeSegment(language),
      device: normalizeSegment(device),
      searchEngine: normalizeSegment(searchEngine),
      apiResponse,
      hitCount: 0,
      expiresAt,
    },
    update: {
      keyword: normalizedKeyword,
      location: normalizeSegment(location),
      language: normalizeSegment(language),
      device: normalizeSegment(device),
      searchEngine: normalizeSegment(searchEngine),
      apiResponse,
      hitCount: 0,
      expiresAt,
    },
  });
}

/** Batch read valid KeywordCache rows keyed by the original keyword string. */
export async function getValidCachesForKeywords(
  endpointType: CacheEndpoint,
  keywords: string[],
  location: string,
  language: string,
  device = 'desktop',
  searchEngine = 'google'
): Promise<Map<string, Prisma.JsonValue>> {
  const results = new Map<string, Prisma.JsonValue>();
  const uniqueKeywords = Array.from(
    new Set(keywords.map(keyword => keyword.trim()).filter(Boolean))
  );

  if (uniqueKeywords.length === 0) {
    return results;
  }

  try {
    const keyByQuery = new Map<string, string>();
    for (const keyword of uniqueKeywords) {
      keyByQuery.set(
        generateQueryKey(
          endpointType,
          keyword,
          location,
          language,
          device,
          searchEngine
        ),
        keyword
      );
    }

    const caches = await keywordCacheClient().findMany({
      where: {
        queryKey: { in: Array.from(keyByQuery.keys()) },
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        queryKey: true,
        apiResponse: true,
      },
    });

    const hitIds: string[] = [];
    for (const cache of caches) {
      const keyword = keyByQuery.get(cache.queryKey);
      if (!keyword) {
        continue;
      }
      results.set(keyword, cache.apiResponse);
      hitIds.push(cache.id);
    }

    if (hitIds.length > 0) {
      void keywordCacheClient()
        .updateMany({
          where: { id: { in: hitIds } },
          data: { hitCount: { increment: 1 } },
        })
        .catch(error => {
          console.error('[cacheService] Failed to increment hitCounts:', error);
        });
    }
  } catch (error) {
    console.error('[cacheService] getValidCachesForKeywords failed:', error);
  }

  return results;
}

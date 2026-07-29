import { DEFAULT_SEMANTIC_LOCATION_CODE } from '@/lib/analysis-state';

const ONE_HOUR_MS = 60 * 60 * 1000;

export type AnalysisCacheEntry<T> = {
  data: T;
  timestamp: number;
  url: string;
  keyword: string;
};

export const SEO_ANALYSIS_CACHE_PREFIX = 'omg-seo-analysis';
export const SEMANTIC_ANALYSIS_CACHE_PREFIX = 'omg-semantic-analysis';
export const ANALYSIS_AI_CACHE_PREFIX = 'omg-analysis-ai';
export const SEO_ANALYSIS_LAST_SESSION_KEY = 'omg-seo-analysis-last';
export const SEMANTIC_ANALYSIS_LAST_SESSION_KEY = 'omg-semantic-analysis-last';
export const ANALYSIS_AI_LAST_SESSION_KEY = 'omg-analysis-ai-last';

export type AnalysisLastSession = {
  cacheKey: string;
  url: string;
  keyword: string;
};

export function readLastAnalysisSession(key: string): AnalysisLastSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const session = JSON.parse(raw) as AnalysisLastSession;
    if (
      !session?.cacheKey ||
      typeof session.url !== 'string' ||
      typeof session.keyword !== 'string'
    ) {
      localStorage.removeItem(key);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function writeLastAnalysisSession(key: string, session: AnalysisLastSession): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(session));
  } catch {
    // Ignore storage access errors.
  }
}

export function clearLastAnalysisSession(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
}

export function readSearchParamsFromWindow(): { url: string; keyword: string } {
  if (typeof window === 'undefined') {
    return { url: '', keyword: '' };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    url: params.get('url')?.trim() ?? '',
    keyword: params.get('keyword')?.trim() ?? '',
  };
}

export function hydrateAnalysisFromStorage<T>(options: {
  prefix: string;
  lastSessionKey: string;
  url?: string;
  keyword?: string;
  locationCode?: number;
  validate: (data: unknown) => data is T;
}): {
  data: T | null;
  url: string;
  keyword: string;
  timestamp: number | null;
  cacheKey: string | null;
} {
  const empty = {
    data: null,
    url: options.url ?? '',
    keyword: options.keyword ?? '',
    timestamp: null,
    cacheKey: null,
  };

  if (typeof window === 'undefined') return empty;

  const urlParam = options.url ?? '';
  const keywordParam = options.keyword ?? '';
  const locationCode = options.locationCode ?? DEFAULT_SEMANTIC_LOCATION_CODE;
  const lastSession = readLastAnalysisSession(options.lastSessionKey);

  const resolvedUrl = urlParam || lastSession?.url || '';
  const resolvedKeyword = keywordParam || lastSession?.keyword || '';
  const resolvedCacheKey =
    urlParam.length > 0
      ? buildAnalysisCacheKey(options.prefix, urlParam, keywordParam, locationCode)
      : (lastSession?.cacheKey ?? null);

  if (!resolvedCacheKey) {
    return {
      ...empty,
      url: resolvedUrl,
      keyword: resolvedKeyword,
    };
  }

  try {
    const cached = readAnalysisCache<T>(resolvedCacheKey);
    if (!cached || !options.validate(cached.data)) {
      if (cached) {
        clearAnalysisCache(resolvedCacheKey);
      }
      return {
        ...empty,
        url: resolvedUrl,
        keyword: resolvedKeyword,
      };
    }

    return {
      data: cached.data,
      url: cached.url || resolvedUrl,
      keyword: cached.keyword || resolvedKeyword,
      timestamp: cached.timestamp,
      cacheKey: resolvedCacheKey,
    };
  } catch {
    clearAnalysisCache(resolvedCacheKey);
    return empty;
  }
}

export function normalizeAnalysisUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return parsed.href.replace(/\/$/, '');
  } catch {
    return trimmed.toLowerCase();
  }
}

export function normalizeAnalysisKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export function buildAnalysisCacheKey(
  prefix: string,
  url: string,
  keyword: string,
  locationCode?: number
): string {
  const base = `${prefix}:${normalizeAnalysisUrl(url)}:${normalizeAnalysisKeyword(keyword)}`;
  if (locationCode !== undefined) {
    return `${base}-${locationCode}`;
  }
  return base;
}

export function parseLocationFromCacheKey(
  cacheKey: string | null | undefined,
  fallback = DEFAULT_SEMANTIC_LOCATION_CODE
): number {
  if (!cacheKey) return fallback;

  const match = cacheKey.match(/-(\d+)$/);
  if (!match) return fallback;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readAnalysisCache<T>(key: string): AnalysisCacheEntry<T> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as AnalysisCacheEntry<T>;
    if (!entry?.data || typeof entry.timestamp !== 'number') {
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() - entry.timestamp >= ONE_HOUR_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

export function writeAnalysisCache<T>(
  key: string,
  entry: AnalysisCacheEntry<T>,
  lastSessionKey?: string
): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(entry));

    if (lastSessionKey) {
      writeLastAnalysisSession(lastSessionKey, {
        cacheKey: key,
        url: entry.url,
        keyword: entry.keyword,
      });
    }
  } catch {
    // Ignore quota errors or private browsing restrictions.
  }
}

export function clearAnalysisCache(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
}

export function formatCachedTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return 'unknown time';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

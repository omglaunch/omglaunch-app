import { ANALYSIS_LOCATION_OPTIONS } from '@/lib/analysis-state';
import { resolveLanguageName } from '@/lib/keyword-audit/geo';
import { resolveDataForSeoLabsLocationCode } from '@/app/(dashboard)/research/research-locations';
import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';
import { getPrisma } from '@/lib/prisma';
import { withFetchTelemetry } from '@/lib/admin/integration-telemetry';
import { logIntegrationHealth } from '@/lib/admin/integration-logging';
import {
  getValidCachesForKeywords,
  setCache,
} from '@/lib/services/cacheService';
import type { Prisma } from '@prisma/client';

const DATAFORSEO_KEYWORD_OVERVIEW_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live';

const DATAFORSEO_BULK_KEYWORD_DIFFICULTY_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live';

const METRICS_TIMEOUT_MS = 20_000;
const OVERVIEW_BATCH_SIZE = 100;

type DataForSeoCredentials = {
  login: string;
  password: string;
};

type KeywordPayload = {
  keyword?: string;
  keyword_info?: {
    search_volume?: number;
    competition?: number;
  };
  keyword_properties?: {
    keyword_difficulty?: number;
  };
};

type OverviewTask = {
  status_code?: number;
  result?: Array<{
    items?: KeywordPayload[];
  }>;
};

type BulkDifficultyItem = {
  keyword?: string;
  keyword_difficulty?: number;
};

type BulkDifficultyTask = {
  status_code?: number;
  result?: Array<{
    items?: BulkDifficultyItem[];
  }>;
};

export type ClusterKeywordMetrics = {
  searchVolume: number | null;
  keywordDifficulty: number | null;
  exactMatch: boolean;
};

export type FetchClusterKeywordMetricsOptions = {
  /** Bypass KeywordCache reads (still writes fresh results). */
  forceRefresh?: boolean;
};

function isMockDataForSeoEnabled(): boolean {
  const flag = process.env.MOCK_DATAFORSEO?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function shouldUseFixtureMetrics(hasCredentials: boolean): boolean {
  if (isMockDataForSeoEnabled()) {
    return true;
  }
  // Keep Gemini map generation testable in local/dev without Labs spend.
  return !hasCredentials && process.env.NODE_ENV !== 'production';
}

function hashKeyword(keyword: string): number {
  let hash = 0;
  for (let index = 0; index < keyword.length; index += 1) {
    hash = (hash * 31 + keyword.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Deterministic fixture volumes/KD for MOCK_DATAFORSEO / local empty creds. */
export function buildMockClusterMetrics(keyword: string): ClusterKeywordMetrics {
  const hash = hashKeyword(keyword.trim().toLowerCase());
  return {
    searchVolume: 50 + (hash % 9200),
    keywordDifficulty: 8 + (hash % 72),
    exactMatch: true,
  };
}

function getEnvCredentials(): DataForSeoCredentials | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) {
    return null;
  }

  return { login, password };
}

async function getIntegrationCredentials(
  workspaceId?: string
): Promise<DataForSeoCredentials | null> {
  const scopedWorkspaceId = workspaceId?.trim();
  if (scopedWorkspaceId) {
    const prisma = getPrisma();
    const integration = await prisma.integrationConfig.findFirst({
      where: { workspaceId: scopedWorkspaceId },
      select: {
        dataForSeoLogin: true,
        dataForSeoPassword: true,
      },
    });

    const login = integration?.dataForSeoLogin?.trim();
    const password = integration?.dataForSeoPassword?.trim();

    if (login && password) {
      return { login, password };
    }
  }

  return getEnvCredentials();
}

function resolveLocationCodeFromLabel(location: string): number {
  const match = ANALYSIS_LOCATION_OPTIONS.find(
    option => option.label.toLowerCase() === location.trim().toLowerCase()
  );

  return match?.code ?? 2458;
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

function resolveDifficulty(payload: KeywordPayload): number | null {
  if (typeof payload.keyword_properties?.keyword_difficulty === 'number') {
    return Math.round(payload.keyword_properties.keyword_difficulty);
  }

  const competition = payload.keyword_info?.competition;
  if (typeof competition === 'number') {
    return Math.round(competition * 100);
  }

  return null;
}

function findExactKeywordPayload(
  items: KeywordPayload[] | undefined,
  keyword: string
): KeywordPayload | null {
  if (!items?.length) {
    return null;
  }

  const normalizedKeyword = normalizeKeyword(keyword);
  return (
    items.find(item => normalizeKeyword(item.keyword ?? '') === normalizedKeyword) ??
    null
  );
}

function parseOverviewMetrics(
  result: OverviewTask['result'],
  keyword: string
): ClusterKeywordMetrics {
  const keywordPayload = findExactKeywordPayload(result?.[0]?.items, keyword);
  if (!keywordPayload) {
    return { searchVolume: null, keywordDifficulty: null, exactMatch: false };
  }

  const searchVolume =
    typeof keywordPayload.keyword_info?.search_volume === 'number'
      ? keywordPayload.keyword_info.search_volume
      : null;

  return {
    searchVolume,
    keywordDifficulty: resolveDifficulty(keywordPayload),
    exactMatch: true,
  };
}

function parseCachedClusterMetrics(
  value: Prisma.JsonValue
): ClusterKeywordMetrics | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const searchVolume =
    typeof record.searchVolume === 'number' ? record.searchVolume : null;
  const keywordDifficulty =
    typeof record.keywordDifficulty === 'number'
      ? record.keywordDifficulty
      : null;
  const exactMatch = record.exactMatch === true;

  if (searchVolume === null && keywordDifficulty === null && !exactMatch) {
    return null;
  }

  return { searchVolume, keywordDifficulty, exactMatch };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>(resolve => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchKeywordOverviewBatch(
  keywords: string[],
  locationCode: number,
  languageName: string,
  credentials: DataForSeoCredentials,
  workspaceId?: string
): Promise<Map<string, ClusterKeywordMetrics>> {
  const results = new Map<string, ClusterKeywordMetrics>();

  for (const keyword of keywords) {
    results.set(keyword, {
      searchVolume: null,
      keywordDifficulty: null,
      exactMatch: false,
    });
  }

  if (keywords.length === 0) {
    return results;
  }

  const { response, value: payload } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_KEYWORD_OVERVIEW_URL,
      workspaceId,
      operation: 'keyword_overview_live',
    },
    async () => {
      const response = await fetch(DATAFORSEO_KEYWORD_OVERVIEW_URL, {
        method: 'POST',
        headers: {
          Authorization: buildDataForSeoAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keywords,
            location_code: locationCode,
            language_name: languageName,
            include_serp_info: false,
          },
        ]),
      });

      const value = (await response.json()) as { tasks?: OverviewTask[] };
      return { response, value };
    }
  );

  if (!response.ok) {
    return results;
  }

  const task = payload.tasks?.[0];
  if (!task || (task.status_code && task.status_code !== 20000) || !task.result) {
    return results;
  }

  for (const keyword of keywords) {
    results.set(keyword, parseOverviewMetrics(task.result, keyword));
  }

  return results;
}

async function fetchBulkKeywordDifficulty(
  keywords: string[],
  locationCode: number,
  languageName: string,
  credentials: DataForSeoCredentials,
  workspaceId?: string
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();

  for (const keyword of keywords) {
    results.set(keyword, null);
  }

  if (keywords.length === 0) {
    return results;
  }

  const { response, value: payload } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_BULK_KEYWORD_DIFFICULTY_URL,
      workspaceId,
      operation: 'bulk_keyword_difficulty_live',
    },
    async () => {
      const response = await fetch(DATAFORSEO_BULK_KEYWORD_DIFFICULTY_URL, {
        method: 'POST',
        headers: {
          Authorization: buildDataForSeoAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keywords,
            location_code: locationCode,
            language_name: languageName,
          },
        ]),
      });

      const value = (await response.json()) as { tasks?: BulkDifficultyTask[] };
      return { response, value };
    }
  );

  if (!response.ok) {
    return results;
  }

  const task = payload.tasks?.[0];
  if (!task || (task.status_code && task.status_code !== 20000) || !task.result) {
    return results;
  }

  const items = task.result[0]?.items ?? [];
  for (const item of items) {
    if (!item.keyword) {
      continue;
    }

    const difficulty =
      typeof item.keyword_difficulty === 'number'
        ? Math.round(item.keyword_difficulty)
        : null;
    results.set(item.keyword, difficulty);
    results.set(normalizeKeyword(item.keyword), difficulty);
  }

  return results;
}

function lookupBulkKeywordDifficulty(
  bulkDifficulty: Map<string, number | null>,
  keyword: string
): number | null | undefined {
  if (bulkDifficulty.has(keyword)) {
    return bulkDifficulty.get(keyword);
  }

  return bulkDifficulty.get(normalizeKeyword(keyword));
}

function keywordNeedsBulkDifficulty(
  metrics: ClusterKeywordMetrics | undefined
): boolean {
  if (!metrics) {
    return true;
  }

  return metrics.keywordDifficulty === null || metrics.keywordDifficulty === undefined;
}

function applyBulkKeywordDifficulty(
  results: Map<string, ClusterKeywordMetrics>,
  keywords: string[],
  bulkDifficulty: Map<string, number | null>
): void {
  for (const keyword of keywords) {
    const current = results.get(keyword);
    if (!current) {
      continue;
    }

    const verifiedKd = lookupBulkKeywordDifficulty(bulkDifficulty, keyword);
    if (verifiedKd === null || verifiedKd === undefined) {
      continue;
    }

    const keywordDifficulty =
      verifiedKd > 0
        ? verifiedKd
        : typeof current.searchVolume === 'number' &&
            current.searchVolume > 500
          ? null
          : verifiedKd;

    results.set(keyword, {
      ...current,
      keywordDifficulty,
    });
  }
}

function chunkKeywords(keywords: string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < keywords.length; index += size) {
    chunks.push(keywords.slice(index, index + size));
  }

  return chunks;
}

async function writeClusterMetricsCache(
  keywords: string[],
  results: Map<string, ClusterKeywordMetrics>,
  locationKey: string,
  languageName: string
): Promise<void> {
  await Promise.all(
    keywords.map(async keyword => {
      const metrics = results.get(keyword);
      if (!metrics || (!metrics.exactMatch && metrics.searchVolume === null)) {
        return;
      }

      try {
        await setCache(
          'keyword_overview',
          keyword,
          locationKey,
          languageName,
          {
            searchVolume: metrics.searchVolume,
            keywordDifficulty: metrics.keywordDifficulty,
            exactMatch: metrics.exactMatch,
          }
        );
      } catch (error) {
        console.error('[dataforseo-metrics] Failed to cache keyword overview:', error);
      }
    })
  );
}

export async function fetchClusterKeywordMetricsBatch(
  keywords: string[],
  location: string,
  workspaceId?: string,
  options: FetchClusterKeywordMetricsOptions = {}
): Promise<Map<string, ClusterKeywordMetrics>> {
  const uniqueKeywords = Array.from(
    new Set(keywords.map(keyword => keyword.trim()).filter(Boolean))
  );
  const results = new Map<string, ClusterKeywordMetrics>();

  for (const keyword of uniqueKeywords) {
    results.set(keyword, {
      searchVolume: null,
      keywordDifficulty: null,
      exactMatch: false,
    });
  }

  if (uniqueKeywords.length === 0) {
    return results;
  }

  const credentials = await getIntegrationCredentials(workspaceId);

  if (shouldUseFixtureMetrics(Boolean(credentials))) {
    for (const keyword of uniqueKeywords) {
      results.set(keyword, buildMockClusterMetrics(keyword));
    }
    return results;
  }

  if (!credentials) {
    return results;
  }

  const serpLocationCode = resolveLocationCodeFromLabel(location);
  const labsLocationCode = resolveDataForSeoLabsLocationCode(serpLocationCode);
  const languageName = resolveLanguageName('en');
  const locationKey = String(labsLocationCode);
  const forceRefresh = options.forceRefresh === true;

  let keywordsToFetch = uniqueKeywords;

  if (!forceRefresh) {
    const cached = await getValidCachesForKeywords(
      'keyword_overview',
      uniqueKeywords,
      locationKey,
      languageName
    );

    const misses: string[] = [];
    for (const keyword of uniqueKeywords) {
      const cachedValue = cached.get(keyword);
      const parsed = cachedValue ? parseCachedClusterMetrics(cachedValue) : null;
      if (parsed) {
        results.set(keyword, parsed);
      } else {
        misses.push(keyword);
      }
    }
    keywordsToFetch = misses;
  }

  if (keywordsToFetch.length === 0) {
    return results;
  }

  const overviewChunks = chunkKeywords(keywordsToFetch, OVERVIEW_BATCH_SIZE);

  for (const chunk of overviewChunks) {
    const overviewMetrics = await withTimeout(
      fetchKeywordOverviewBatch(
        chunk,
        labsLocationCode,
        languageName,
        credentials,
        workspaceId
      ),
      METRICS_TIMEOUT_MS
    );

    if (overviewMetrics === null) {
      await logIntegrationHealth({
        workspaceId,
        integrationType: 'DATAFORSEO',
        status: 'TIMEOUT',
        targetUrl: DATAFORSEO_KEYWORD_OVERVIEW_URL,
        latencyMs: METRICS_TIMEOUT_MS,
        errorMessage: `keyword_overview timed out after ${METRICS_TIMEOUT_MS}ms`,
      });
      continue;
    }

    for (const [keyword, metrics] of Array.from(overviewMetrics.entries())) {
      results.set(keyword, metrics);
    }
  }

  const keywordsNeedingBulkDifficulty = keywordsToFetch.filter(keyword =>
    keywordNeedsBulkDifficulty(results.get(keyword))
  );

  if (keywordsNeedingBulkDifficulty.length > 0) {
    const bulkDifficulty = await withTimeout(
      fetchBulkKeywordDifficulty(
        keywordsNeedingBulkDifficulty,
        labsLocationCode,
        languageName,
        credentials,
        workspaceId
      ),
      METRICS_TIMEOUT_MS
    );

    if (bulkDifficulty) {
      applyBulkKeywordDifficulty(
        results,
        keywordsNeedingBulkDifficulty,
        bulkDifficulty
      );
    }
  }

  await writeClusterMetricsCache(
    keywordsToFetch,
    results,
    locationKey,
    languageName
  );

  return results;
}

import { getPrisma } from '@/lib/prisma';
import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';
import { getValidCache, setCache } from '@/lib/services/cacheService';
import {
  assertLabsLiveFetchAllowed,
  estimateLabsTasksForResearchSeed,
  isLabsBudgetExceededError,
} from '@/lib/silo-builder/labs-budget';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { resolveLanguageName, resolveLocationCode, type KeywordAuditGeoInput } from '@/lib/keyword-audit/geo';
import { resolveDataForSeoLabsLocationCode } from '@/app/(dashboard)/research/research-locations';
import { withFetchTelemetry } from '@/lib/admin/integration-telemetry';

const DATAFORSEO_KEYWORD_IDEAS_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live';

const DATAFORSEO_SERP_ORGANIC_URL =
  'https://api.dataforseo.com/v3/serp/google/organic/live/regular';

export type KeywordAuditCompetitor = {
  url: string;
  title: string;
  domain: string;
};

export type KeywordAuditSeoMetrics = {
  searchVolume: number | null;
  keywordDifficulty: number | null;
  topCompetitors: KeywordAuditCompetitor[];
  fromCache?: {
    metrics: boolean;
    serp: boolean;
  };
};

export type FetchKeywordAuditSeoMetricsOptions = {
  workspaceId?: string;
  forceRefresh?: boolean;
};

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

type DataForSeoTask = {
  status_code?: number;
  status_message?: string;
  result?: Array<{
    items?: KeywordPayload[];
  }>;
};

type SerpOrganicItem = {
  type?: string;
  title?: string;
  url?: string;
  domain?: string;
};

type SerpTask = {
  status_code?: number;
  status_message?: string;
  result?: Array<{
    items?: SerpOrganicItem[];
  }>;
};

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

function findKeywordPayload(
  items: KeywordPayload[] | undefined,
  keyword: string
): KeywordPayload | null {
  if (!items?.length) {
    return null;
  }

  const normalizedKeyword = keyword.trim().toLowerCase();
  const exactMatch = items.find(
    item => item.keyword?.trim().toLowerCase() === normalizedKeyword
  );

  return exactMatch ?? items[0] ?? null;
}

function parseKeywordMetricsFromResult(
  result: DataForSeoTask['result'],
  keyword: string
): { searchVolume: number | null; keywordDifficulty: number | null } {
  const keywordPayload = findKeywordPayload(result?.[0]?.items, keyword);
  if (!keywordPayload) {
    return { searchVolume: null, keywordDifficulty: null };
  }

  const searchVolume =
    typeof keywordPayload.keyword_info?.search_volume === 'number'
      ? keywordPayload.keyword_info.search_volume
      : null;

  return {
    searchVolume,
    keywordDifficulty: resolveDifficulty(keywordPayload),
  };
}

function parseCompetitorsFromSerpResult(
  result: SerpTask['result']
): KeywordAuditCompetitor[] {
  const organicItems = (result?.[0]?.items ?? []).filter(
    item => item.type === 'organic' && item.url && item.title
  );

  return organicItems.slice(0, 3).map(item => ({
    url: item.url!.trim(),
    title: item.title!.trim(),
    domain: item.domain?.trim() || new URL(item.url!).hostname.replace(/^www\./, ''),
  }));
}

function isSuccessfulTask(task: { status_code?: number; result?: unknown } | undefined): boolean {
  return Boolean(task && (!task.status_code || task.status_code === 20000) && task.result);
}

async function fetchKeywordMetricsLive(
  keyword: string,
  locationCode: number,
  languageName: string,
  credentials: DataForSeoCredentials,
  workspaceId?: string
): Promise<{ result: DataForSeoTask['result']; metrics: { searchVolume: number | null; keywordDifficulty: number | null } }> {
  const { response, value: payload } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_KEYWORD_IDEAS_URL,
      workspaceId,
      operation: 'keyword_audit_ideas',
    },
    async () => {
      const response = await fetch(DATAFORSEO_KEYWORD_IDEAS_URL, {
        method: 'POST',
        headers: {
          Authorization: buildDataForSeoAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keywords: [keyword],
            location_code: locationCode,
            language_name: languageName,
            limit: 10,
            include_serp_info: true,
          },
        ]),
      });

      const payload = (await response.json()) as { tasks?: DataForSeoTask[] };
      return { response, value: payload };
    }
  );

  if (!response.ok) {
    return { result: undefined, metrics: { searchVolume: null, keywordDifficulty: null } };
  }

  const task = payload.tasks?.[0];

  if (!isSuccessfulTask(task)) {
    return { result: undefined, metrics: { searchVolume: null, keywordDifficulty: null } };
  }

  return {
    result: task!.result,
    metrics: parseKeywordMetricsFromResult(task!.result, keyword),
  };
}

async function fetchTopCompetitorsLive(
  keyword: string,
  locationCode: number,
  languageName: string,
  device: 'desktop' | 'mobile',
  credentials: DataForSeoCredentials,
  workspaceId?: string
): Promise<{ result: SerpTask['result']; competitors: KeywordAuditCompetitor[] }> {
  const { response, value: payload } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_SERP_ORGANIC_URL,
      workspaceId,
      operation: 'keyword_audit_serp',
    },
    async () => {
      const response = await fetch(DATAFORSEO_SERP_ORGANIC_URL, {
        method: 'POST',
        headers: {
          Authorization: buildDataForSeoAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keyword,
            location_code: locationCode,
            language_name: languageName,
            device,
            depth: 10,
          },
        ]),
      });

      const payload = (await response.json()) as { tasks?: SerpTask[] };
      return { response, value: payload };
    }
  );

  if (!response.ok) {
    return { result: undefined, competitors: [] };
  }

  const task = payload.tasks?.[0];

  if (!isSuccessfulTask(task)) {
    return { result: undefined, competitors: [] };
  }

  return {
    result: task!.result,
    competitors: parseCompetitorsFromSerpResult(task!.result),
  };
}

async function fetchKeywordMetrics(
  keyword: string,
  locationCode: number,
  languageName: string,
  device: string,
  credentials: DataForSeoCredentials,
  forceRefresh: boolean,
  workspaceId?: string
): Promise<{ searchVolume: number | null; keywordDifficulty: number | null; fromCache: boolean }> {
  const location = String(locationCode);
  const language = languageName;

  if (!forceRefresh) {
    const cachedResult = await getValidCache(
      'keyword_ideas',
      keyword,
      location,
      language,
      device,
      'google'
    );

    if (cachedResult !== null) {
      const parsed = parseKeywordMetricsFromResult(
        cachedResult as DataForSeoTask['result'],
        keyword
      );

      if (parsed.searchVolume !== null || parsed.keywordDifficulty !== null) {
        console.log('[keyword-audit] Keyword metrics cache hit');
        return { ...parsed, fromCache: true };
      }

      console.log('[keyword-audit] Keyword metrics cache stale/unparseable — fetching live');
    }
  }

  if (workspaceId?.trim()) {
    await assertLabsLiveFetchAllowed(
      workspaceId,
      estimateLabsTasksForResearchSeed()
    );
  }

  const live = await fetchKeywordMetricsLive(
    keyword,
    locationCode,
    languageName,
    credentials,
    workspaceId
  );

  if (live.result) {
    try {
      await setCache(
        'keyword_ideas',
        keyword,
        location,
        language,
        live.result as Parameters<typeof setCache>[4],
        device,
        'google'
      );
    } catch (error) {
      console.error('[keyword-audit] Failed to write keyword metrics cache:', error);
    }
  }

  return { ...live.metrics, fromCache: false };
}

async function fetchTopCompetitors(
  keyword: string,
  locationCode: number,
  languageName: string,
  device: 'desktop' | 'mobile',
  credentials: DataForSeoCredentials,
  forceRefresh: boolean,
  workspaceId?: string
): Promise<{ competitors: KeywordAuditCompetitor[]; fromCache: boolean }> {
  const location = String(locationCode);
  const language = languageName;

  if (!forceRefresh) {
    const cachedResult = await getValidCache(
      'serp_live',
      keyword,
      location,
      language,
      device,
      'google'
    );

    if (cachedResult !== null) {
      console.log('[keyword-audit] SERP cache hit');
      return {
        competitors: parseCompetitorsFromSerpResult(cachedResult as SerpTask['result']),
        fromCache: true,
      };
    }
  }

  const live = await fetchTopCompetitorsLive(
    keyword,
    locationCode,
    languageName,
    device,
    credentials,
    workspaceId
  );

  if (live.result) {
    try {
      await setCache(
        'serp_live',
        keyword,
        location,
        language,
        live.result as Parameters<typeof setCache>[4],
        device,
        'google'
      );
    } catch (error) {
      console.error('[keyword-audit] Failed to write SERP cache:', error);
    }
  }

  return { competitors: live.competitors, fromCache: false };
}

export async function fetchKeywordAuditSeoMetrics(
  keyword: string,
  geo: KeywordAuditGeoInput,
  options: FetchKeywordAuditSeoMetricsOptions = {}
): Promise<KeywordAuditSeoMetrics | null> {
  const credentials = await getIntegrationCredentials(options.workspaceId);
  if (!credentials) {
    return null;
  }

  const serpLocationCode = resolveLocationCode(geo.country, geo.city);
  const labsLocationCode = resolveDataForSeoLabsLocationCode(serpLocationCode);
  const languageName = resolveLanguageName(geo.language);
  const device = geo.device === 'mobile' ? 'mobile' : 'desktop';
  const forceRefresh = options.forceRefresh ?? false;

  try {
    const [metrics, serp] = await Promise.all([
      fetchKeywordMetrics(
        keyword,
        labsLocationCode,
        languageName,
        device,
        credentials,
        forceRefresh,
        options.workspaceId
      ),
      fetchTopCompetitors(
        keyword,
        serpLocationCode,
        languageName,
        device,
        credentials,
        forceRefresh,
        options.workspaceId
      ),
    ]);

    return {
      searchVolume: metrics.searchVolume,
      keywordDifficulty: metrics.keywordDifficulty,
      topCompetitors: serp.competitors,
      fromCache: {
        metrics: metrics.fromCache,
        serp: serp.fromCache,
      },
    };
  } catch (error) {
    if (
      isLabsBudgetExceededError(error) ||
      error instanceof IntegrationCircuitOpenError
    ) {
      throw error;
    }
    return null;
  }
}

'use server';

import { extractNamedEntitiesFromText, generateNamedEntitySchemaJsonLd } from '@/lib/ai';
import { countPhraseOccurrences, fetchPageCleanText } from '@/lib/page-keyword-frequency';
import { getPrisma } from '@/lib/prisma';
import { scrapePageText } from '@/lib/scraper';
import { getValidCache, getCacheMetadata, setCache } from '@/lib/services/cacheService';
import { withFetchTelemetry } from '@/lib/admin/integration-telemetry';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import {
  assertLabsLiveFetchAllowed,
  estimateLabsTasksForResearchSeed,
  isLabsBudgetExceededError,
} from '@/lib/silo-builder/labs-budget';
import type {
  EntityRelationship,
  MonthlySearchPoint,
  NamedEntity,
  NamedEntityCategory,
  NamedEntitiesResult,
  RelatedKeyword,
  RelatedKeywordIntention,
  ResearchSerpFeatures,
} from '@/lib/semantic-metrics';

import { getResearchLocationLabel, resolveDataForSeoLabsLocationCode } from '@/app/(dashboard)/research/research-locations';

const DATAFORSEO_RELATED_KEYWORDS_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live';

const DATAFORSEO_KEYWORD_IDEAS_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live';

const DATAFORSEO_SERP_ORGANIC_URL =
  'https://api.dataforseo.com/v3/serp/google/organic/live/regular';

const INTERROGATIVE_WORD_REGEX =
  /^(how|what|why|when|where|who|which|is|are|can|do|does|will|should)\b/i;

const VALID_ENTITY_CATEGORIES = new Set<string>([
  'Person',
  'Organization',
  'Location',
  'Product',
  'Concept',
]);

export type FetchRelatedKeywordsResult = {
  keywords: RelatedKeyword[];
  fromCache: boolean;
  cachedAt: string | null;
  error?: string;
};

export type FetchRelatedQuestionsResult = {
  questions: RelatedKeyword[];
  fromCache: boolean;
  cachedAt: string | null;
  error?: string;
};

export type FetchKeywordIdeasResult = {
  ideas: RelatedKeyword[];
  fromCache: boolean;
  cachedAt: string | null;
  error?: string;
};

export type FetchNamedEntitiesResult = {
  data: NamedEntitiesResult | null;
  error?: string;
};

export type GenerateNamedEntitySchemaResult = {
  schema: string;
  error?: string;
};

type DataForSeoKeywordInfo = {
  search_volume?: number;
  cpc?: number;
  competition?: number;
  monthly_searches?: Array<{
    year?: number;
    month?: number;
    search_volume?: number;
  }>;
};

type DataForSeoSerpInfo = {
  serp_item_types?: string[];
};

type DataForSeoKeywordPayload = {
  keyword?: string;
  keyword_info?: DataForSeoKeywordInfo;
  keyword_properties?: {
    keyword_difficulty?: number;
  };
  search_intent_info?: {
    main_intent?: string;
  };
  serp_info?: DataForSeoSerpInfo;
};

type DataForSeoRelatedKeywordItem = {
  keyword_data?: DataForSeoKeywordPayload;
};

type DataForSeoTask = {
  status_code?: number;
  status_message?: string;
  result?: Array<{
    items?: Array<DataForSeoRelatedKeywordItem | DataForSeoKeywordPayload>;
  }>;
};

type DataForSeoResponse = {
  tasks?: DataForSeoTask[];
};

type DataForSeoKeywordIdeaItem = DataForSeoKeywordPayload;

type SerpOrganicItem = {
  type?: string;
  title?: string;
  description?: string;
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

function normalizeEntityCategory(value: string): NamedEntityCategory {
  const trimmed = value.trim();
  if (VALID_ENTITY_CATEGORIES.has(trimmed)) {
    return trimmed as NamedEntityCategory;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('person')) return 'Person';
  if (lower.includes('org')) return 'Organization';
  if (lower.includes('location') || lower.includes('place')) return 'Location';
  if (lower.includes('product')) return 'Product';
  return 'Concept';
}

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase();
}

function mapGeminiEntity(
  entity: {
    entityName: string;
    category: string;
    salience: number;
    description: string;
    sourceUrl?: string;
    sourceUrls?: string[];
  },
  validSourceUrls: string[],
  fallbackSourceUrl = ''
): NamedEntity {
  const resolvedUrls = resolveEntitySourceUrls(
    entity.sourceUrl,
    entity.sourceUrls,
    validSourceUrls,
    fallbackSourceUrl
  );

  return {
    entityName: entity.entityName.trim(),
    category: normalizeEntityCategory(entity.category),
    salience: Math.min(1, Math.max(0, entity.salience)),
    description: entity.description.trim(),
    sourceUrl: resolvedUrls.primary,
    sourceUrls: resolvedUrls.all,
  };
}

function resolveEntitySourceUrls(
  sourceUrl: string | undefined,
  sourceUrls: string[] | undefined,
  validSourceUrls: string[],
  fallbackSourceUrl: string
): { primary: string; all: string[] } {
  const validSet = new Set(validSourceUrls);
  const candidates = [
    ...(sourceUrls ?? []),
    ...(sourceUrl ? [sourceUrl] : []),
  ]
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => matchValidSourceUrl(url, validSourceUrls))
    .filter((url): url is string => Boolean(url));

  const unique = Array.from(new Set(candidates));

  if (unique.length === 0) {
    const fallback = fallbackSourceUrl && validSet.has(fallbackSourceUrl) ? fallbackSourceUrl : '';
    return { primary: fallback, all: fallback ? [fallback] : [] };
  }

  const primary =
    validSourceUrls.find(url => unique.includes(url)) ??
    unique[0] ??
    '';

  return { primary, all: unique };
}

function matchValidSourceUrl(url: string, validSourceUrls: string[]): string | null {
  if (validSourceUrls.includes(url)) {
    return url;
  }

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return (
      validSourceUrls.find(validUrl => {
        try {
          return new URL(validUrl).hostname.replace(/^www\./, '').toLowerCase() === hostname;
        } catch {
          return false;
        }
      }) ?? null
    );
  } catch {
    return null;
  }
}

function dedupeEntities(entities: NamedEntity[], rankOrderedUrls: string[] = []): NamedEntity[] {
  const map = new Map<string, NamedEntity>();

  for (const entity of entities) {
    const key = normalizeEntityName(entity.entityName);
    const existing = map.get(key);
    const mergedUrls = Array.from(
      new Set([...(existing?.sourceUrls ?? []), ...(entity.sourceUrls ?? []), entity.sourceUrl])
    ).filter(Boolean);

    const authoritativeUrl =
      rankOrderedUrls.find(url => mergedUrls.includes(url)) ??
      mergedUrls[0] ??
      entity.sourceUrl;

    if (!existing || entity.salience > existing.salience) {
      map.set(key, {
        ...entity,
        sourceUrls: mergedUrls,
        sourceUrl: authoritativeUrl,
      });
      continue;
    }

    map.set(key, {
      ...existing,
      sourceUrls: mergedUrls,
      sourceUrl:
        rankOrderedUrls.find(url => mergedUrls.includes(url)) ??
        existing.sourceUrl ??
        authoritativeUrl,
      salience: Math.max(existing.salience, entity.salience),
    });
  }

  return Array.from(map.values()).sort((a, b) => b.salience - a.salience);
}

function buildCompetitorCorpus(items: SerpOrganicItem[]): {
  text: string;
  sourceUrls: string[];
} {
  const sourceUrls = items
    .map(item => item.url?.trim() ?? '')
    .filter(Boolean);

  const text = items
    .map((item, index) => {
      const title = item.title?.trim() ?? '';
      const description = item.description?.trim() ?? '';
      const url = item.url?.trim() ?? '';
      return `--- Competitor Result ${index + 1} ---
URL: ${url}
Title: ${title}
Description: ${description}`;
    })
    .join('\n\n');

  return { text, sourceUrls };
}

function normalizeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function mapMonthlySearches(
  raw: DataForSeoKeywordInfo['monthly_searches']
): MonthlySearchPoint[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (point): point is { year: number; month: number; search_volume: number } =>
        typeof point?.year === 'number' &&
        typeof point?.month === 'number' &&
        typeof point?.search_volume === 'number'
    )
    .map(point => ({
      year: point.year,
      month: point.month,
      searchVolume: point.search_volume,
    }));
}

function computeYoyChange(monthlySearches: MonthlySearchPoint[]): number | null {
  if (monthlySearches.length < 2) return null;

  const sorted = [...monthlySearches].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
  const latest = sorted[sorted.length - 1];
  const priorYear = sorted.find(
    point => point.year === latest.year - 1 && point.month === latest.month
  );

  if (!priorYear || priorYear.searchVolume === 0) return null;

  return Math.round(
    ((latest.searchVolume - priorYear.searchVolume) / priorYear.searchVolume) * 100
  );
}

function extractSerpFeatures(serpInfo?: DataForSeoSerpInfo): ResearchSerpFeatures {
  const types = (serpInfo?.serp_item_types ?? []).map(type => type.toLowerCase());

  return {
    localPack: types.some(type => type.includes('local')),
    featuredSnippet: types.some(type => type.includes('featured')),
  };
}

function resolveKeywordPayload(
  item: DataForSeoRelatedKeywordItem | DataForSeoKeywordPayload
): DataForSeoKeywordPayload | null {
  if ('keyword_data' in item && item.keyword_data) {
    return item.keyword_data;
  }

  if ('keyword' in item || 'keyword_info' in item) {
    return item as DataForSeoKeywordPayload;
  }

  return null;
}

function resolveDifficulty(
  keywordProperties?: DataForSeoKeywordPayload['keyword_properties'],
  keywordInfo?: DataForSeoKeywordInfo
): number | null {
  if (typeof keywordProperties?.keyword_difficulty === 'number') {
    return Math.round(keywordProperties.keyword_difficulty);
  }

  if (typeof keywordInfo?.competition === 'number') {
    return Math.round(keywordInfo.competition * 100);
  }

  return null;
}

function mapIntention(value: string | undefined): RelatedKeywordIntention {
  const normalized = (value ?? 'informational').toLowerCase();

  if (normalized.includes('commercial')) return 'commercial';
  if (normalized.includes('navigational')) return 'navigational';
  if (normalized.includes('transactional')) return 'transactional';
  return 'informational';
}

function computeInterestScore(searchVolume: number, difficulty: number): number {
  const safeVolume = Math.max(searchVolume, 0);
  const safeDifficulty = Math.min(Math.max(difficulty, 0), 100);

  const volumeComponent = Math.min(65, (Math.log10(safeVolume + 1) / Math.log10(1_000_001)) * 65);
  const difficultyComponent = Math.max(0, 35 - safeDifficulty * 0.35);

  return Math.min(100, Math.round(volumeComponent + difficultyComponent));
}

function mapPayloadToRelatedKeyword(
  payload: DataForSeoKeywordPayload,
  pageText: string
): RelatedKeyword | null {
  const expression = payload.keyword?.trim() || '';

  if (!expression) {
    return null;
  }

  const keywordInfo = payload.keyword_info;
  const searchVolume = keywordInfo?.search_volume ?? 0;
  const cpc =
    typeof keywordInfo?.cpc === 'number' ? Math.round(keywordInfo.cpc * 100) / 100 : null;
  const difficulty = resolveDifficulty(payload.keyword_properties, keywordInfo);
  const concurrence =
    typeof keywordInfo?.competition === 'number'
      ? Math.round(keywordInfo.competition * 100)
      : 0;
  const monthlySearches = mapMonthlySearches(keywordInfo?.monthly_searches);
  const intention = payload.search_intent_info?.main_intent
    ? mapIntention(payload.search_intent_info.main_intent)
    : null;

  return {
    expression,
    frequency: countPhraseOccurrences(pageText, expression),
    searchVolume,
    concurrence,
    cpc,
    difficulty,
    intention,
    interestScore: computeInterestScore(searchVolume, difficulty ?? 0),
    monthlySearches,
    serpFeatures: extractSerpFeatures(payload.serp_info),
    yoyChange: computeYoyChange(monthlySearches),
  };
}

function mapItemToRelatedKeyword(
  item: DataForSeoRelatedKeywordItem | DataForSeoKeywordPayload,
  pageText: string
): RelatedKeyword | null {
  const payload = resolveKeywordPayload(item);
  if (!payload) return null;
  const mapped = mapPayloadToRelatedKeyword(payload, pageText);
  if (!mapped) return null;
  return { ...mapped, rawLabsPayload: item };
}

function getDataForSeoCredentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) {
    return null;
  }

  return { login, password };
}

/** Resolve workspace + gate Labs spend before a live Research call. Returns error message if blocked. */
async function gateResearchLabsLiveFetch(): Promise<
  { workspaceId: string } | { error: string }
> {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    await assertLabsLiveFetchAllowed(
      workspaceId,
      estimateLabsTasksForResearchSeed()
    );
    return { workspaceId };
  } catch (error) {
    if (isLabsBudgetExceededError(error)) {
      return { error: error.message };
    }
    if (error instanceof IntegrationCircuitOpenError) {
      return { error: error.message };
    }
    if (isUnauthenticatedError(error)) {
      return { error: 'Unauthorized' };
    }
    throw error;
  }
}

function normalizeRequestKeyword(keyword: string): string {
  return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isSuccessfulDataForSeoTask(
  task: DataForSeoTask | undefined
): task is DataForSeoTask & { result: NonNullable<DataForSeoTask['result']> } {
  return (
    task != null &&
    task.status_code === 20000 &&
    task.result != null &&
    task.result.length > 0
  );
}

function mapRelatedKeywordItems(
  result: DataForSeoTask['result'],
  pageText: string
): RelatedKeyword[] {
  const items = result?.[0]?.items ?? [];

  return items
    .map(item => mapItemToRelatedKeyword(item, pageText))
    .filter((keyword): keyword is RelatedKeyword => keyword !== null)
    .sort((a, b) => b.interestScore - a.interestScore);
}

function mapKeywordIdeaItems(
  result: DataForSeoTask['result'],
  pageText = ''
): RelatedKeyword[] {
  const items = (result?.[0]?.items ?? []) as DataForSeoKeywordIdeaItem[];
  const mappedItems: RelatedKeyword[] = [];

  for (const item of items) {
    const mapped = mapPayloadToRelatedKeyword(item, pageText);
    if (!mapped) continue;
    mappedItems.push({ ...mapped, rawLabsPayload: item });
  }

  return mappedItems.sort((a, b) => b.searchVolume - a.searchVolume);
}

function mapRelatedQuestionItems(
  result: DataForSeoTask['result']
): RelatedKeyword[] {
  return mapKeywordIdeaItems(result).slice(0, 50);
}

async function readCacheWithMetadata(
  endpointType: 'related_keywords' | 'related_questions' | 'keyword_ideas',
  keyword: string,
  location: string,
  language: string,
  device: string,
  searchEngine: string
): Promise<{ result: DataForSeoTask['result']; cachedAt: string } | null> {
  const cachedResult = await getValidCache(
    endpointType,
    keyword,
    location,
    language,
    device,
    searchEngine
  );

  if (cachedResult === null) {
    return null;
  }

  const metadata = await getCacheMetadata(
    endpointType,
    keyword,
    location,
    language,
    device,
    searchEngine
  );

  return {
    result: cachedResult as DataForSeoTask['result'],
    cachedAt: metadata?.createdAt.toISOString() ?? new Date().toISOString(),
  };
}

export type FetchRelatedKeywordsOptions = {
  language?: string;
  device?: string;
  searchEngine?: string;
  forceRefresh?: boolean;
};

export async function fetchRelatedKeywords(
  seedKeyword: string,
  locationCode: number,
  targetUrl?: string,
  options: FetchRelatedKeywordsOptions = {}
): Promise<FetchRelatedKeywordsResult> {
  const keyword = normalizeRequestKeyword(seedKeyword);
  const labsLocationCode = resolveDataForSeoLabsLocationCode(locationCode);
  const location = String(labsLocationCode);
  const language = options.language?.trim() || 'English';
  const device = options.device?.trim() || 'desktop';
  const searchEngine = options.searchEngine?.trim() || 'google';
  const forceRefresh = options.forceRefresh ?? false;
  const trimmedUrl = targetUrl?.trim() ?? '';

  if (!keyword) {
    return { keywords: [], fromCache: false, cachedAt: null, error: 'Target keyword is required.' };
  }

  if (!forceRefresh) {
    try {
      const cached = await readCacheWithMetadata(
        'related_keywords',
        keyword,
        location,
        language,
        device,
        searchEngine
      );

      if (cached !== null) {
        console.log('✅ CACHE HIT - SAVED API CREDITS');

        const pageText = trimmedUrl
          ? await fetchPageCleanText(trimmedUrl).catch(() => '')
          : '';
        const keywords = mapRelatedKeywordItems(cached.result, pageText);

        if (keywords.length === 0) {
          return {
            keywords: [],
            fromCache: true,
            cachedAt: cached.cachedAt,
            error: 'No related keywords were found for this seed keyword.',
          };
        }

        return { keywords, fromCache: true, cachedAt: cached.cachedAt };
      }
    } catch (error) {
      console.error(
        '[fetchRelatedKeywords] Cache lookup failed, falling back to live fetch:',
        error
      );
    }
  }

  console.log('⚠️ CACHE MISS - FETCHING DATAFORSEO');

  const credentials = getDataForSeoCredentials();
  if (!credentials) {
    return {
      keywords: [],
      fromCache: false,
      cachedAt: null,
      error: 'DataForSEO credentials are not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    };
  }

  const gate = await gateResearchLabsLiveFetch();
  if ('error' in gate) {
    return {
      keywords: [],
      fromCache: false,
      cachedAt: null,
      error: gate.error,
    };
  }

  const authToken = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const [{ response, value: payload }, pageText] = await Promise.all([
      withFetchTelemetry(
        {
          integrationType: 'DATAFORSEO',
          targetUrl: DATAFORSEO_RELATED_KEYWORDS_URL,
          workspaceId: gate.workspaceId,
          operation: 'research_related_keywords',
          skipCircuitCheck: true,
        },
        async () => {
          const response = await fetch(DATAFORSEO_RELATED_KEYWORDS_URL, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([
              {
                keyword,
                location_code: labsLocationCode,
                language_name: language,
                limit: 50,
                depth: 2,
                include_serp_info: true,
              },
            ]),
          });
          const value = (await response.json()) as DataForSeoResponse;
          return { response, value };
        }
      ),
      trimmedUrl
        ? fetchPageCleanText(trimmedUrl).catch(() => '')
        : Promise.resolve(''),
    ]);

    if (!response.ok) {
      return {
        keywords: [],
        fromCache: false,
        cachedAt: null,
        error: `DataForSEO request failed with status ${response.status}.`,
      };
    }

    const task = payload.tasks?.[0];

    if (!task) {
      return { keywords: [], fromCache: false, cachedAt: null, error: 'DataForSEO returned no task data.' };
    }

    if (task.status_code && task.status_code !== 20000) {
      return {
        keywords: [],
        fromCache: false,
        cachedAt: null,
        error: task.status_message ?? 'DataForSEO returned an error for this keyword.',
      };
    }

    if (isSuccessfulDataForSeoTask(task)) {
      try {
        await setCache(
          'related_keywords',
          keyword,
          location,
          language,
          task.result,
          device,
          searchEngine
        );
      } catch (error) {
        console.error('[fetchRelatedKeywords] Cache write failed:', error);
      }
    }

    const keywords = mapRelatedKeywordItems(task.result, pageText);

    if (keywords.length === 0) {
      return {
        keywords: [],
        fromCache: false,
        cachedAt: null,
        error: 'No related keywords were found for this seed keyword.',
      };
    }

    return { keywords, fromCache: false, cachedAt: new Date().toISOString() };
  } catch (error) {
    console.log('DataForSEO API Error:', error);

    const message =
      error instanceof Error ? error.message : 'Unexpected error while fetching related keywords.';

    return { keywords: [], fromCache: false, cachedAt: null, error: message };
  }
}

export type FetchRelatedQuestionsOptions = {
  language?: string;
  device?: string;
  searchEngine?: string;
  forceRefresh?: boolean;
};

export async function fetchRelatedQuestions(
  seedKeyword: string,
  locationCode: number,
  options: FetchRelatedQuestionsOptions = {}
): Promise<FetchRelatedQuestionsResult> {
  const keyword = normalizeRequestKeyword(seedKeyword);
  const labsLocationCode = resolveDataForSeoLabsLocationCode(locationCode);
  const location = String(labsLocationCode);
  const language = options.language?.trim() || 'English';
  const device = options.device?.trim() || 'desktop';
  const searchEngine = options.searchEngine?.trim() || 'google';
  const forceRefresh = options.forceRefresh ?? false;

  if (!keyword) {
    return { questions: [], fromCache: false, cachedAt: null, error: 'Target keyword is required.' };
  }

  if (!forceRefresh) {
    try {
      const cached = await readCacheWithMetadata(
        'related_questions',
        keyword,
        location,
        language,
        device,
        searchEngine
      );

      if (cached !== null) {
        console.log('✅ CACHE HIT - SAVED API CREDITS');

        const questions = mapRelatedQuestionItems(cached.result);

        if (questions.length === 0) {
          return {
            questions: [],
            fromCache: true,
            cachedAt: cached.cachedAt,
            error: 'No related questions were found for this seed keyword.',
          };
        }

        return { questions, fromCache: true, cachedAt: cached.cachedAt };
      }
    } catch (error) {
      console.error(
        '[fetchRelatedQuestions] Cache lookup failed, falling back to live fetch:',
        error
      );
    }
  }

  console.log('⚠️ CACHE MISS - FETCHING DATAFORSEO');

  const credentials = getDataForSeoCredentials();
  if (!credentials) {
    return {
      questions: [],
      fromCache: false,
      cachedAt: null,
      error: 'DataForSEO credentials are not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    };
  }

  const gate = await gateResearchLabsLiveFetch();
  if ('error' in gate) {
    return {
      questions: [],
      fromCache: false,
      cachedAt: null,
      error: gate.error,
    };
  }

  const authToken = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const { response, value: payload } = await withFetchTelemetry(
      {
        integrationType: 'DATAFORSEO',
        targetUrl: DATAFORSEO_KEYWORD_IDEAS_URL,
        workspaceId: gate.workspaceId,
        operation: 'research_related_questions',
        skipCircuitCheck: true,
      },
      async () => {
        const response = await fetch(DATAFORSEO_KEYWORD_IDEAS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              keywords: [keyword],
              location_code: labsLocationCode,
              language_name: language,
              limit: 700,
              include_serp_info: true,
              filters: [
                'keyword',
                'regex',
                '^(how|what|why|when|where|who|which|is|are|can|do|does|will|should)\\b',
              ],
            },
          ]),
        });
        const value = (await response.json()) as DataForSeoResponse;
        return { response, value };
      }
    );

    if (!response.ok) {
      return {
        questions: [],
        fromCache: false,
        cachedAt: null,
        error: `DataForSEO request failed with status ${response.status}.`,
      };
    }

    const task = payload.tasks?.[0];

    if (!task) {
      return { questions: [], fromCache: false, cachedAt: null, error: 'DataForSEO returned no task data.' };
    }

    if (task.status_code && task.status_code !== 20000) {
      return {
        questions: [],
        fromCache: false,
        cachedAt: null,
        error: task.status_message ?? 'DataForSEO returned an error for this keyword.',
      };
    }

    if (isSuccessfulDataForSeoTask(task)) {
      try {
        await setCache(
          'related_questions',
          keyword,
          location,
          language,
          task.result,
          device,
          searchEngine
        );
      } catch (error) {
        console.error('[fetchRelatedQuestions] Cache write failed:', error);
      }
    }

    const questions = mapRelatedQuestionItems(task.result);

    if (questions.length === 0) {
      return {
        questions: [],
        fromCache: false,
        cachedAt: null,
        error: 'No related questions were found for this seed keyword.',
      };
    }

    return { questions, fromCache: false, cachedAt: new Date().toISOString() };
  } catch (error) {
    console.log('DataForSEO API Error:', error);

    const message =
      error instanceof Error ? error.message : 'Unexpected error while fetching related questions.';

    return { questions: [], fromCache: false, cachedAt: null, error: message };
  }
}

export type FetchKeywordIdeasOptions = {
  language?: string;
  device?: string;
  searchEngine?: string;
  forceRefresh?: boolean;
};

export async function fetchKeywordIdeas(
  seedKeyword: string,
  locationCode: number,
  options: FetchKeywordIdeasOptions = {}
): Promise<FetchKeywordIdeasResult> {
  const keyword = normalizeRequestKeyword(seedKeyword);
  const labsLocationCode = resolveDataForSeoLabsLocationCode(locationCode);
  const location = String(labsLocationCode);
  const language = options.language?.trim() || 'English';
  const device = options.device?.trim() || 'desktop';
  const searchEngine = options.searchEngine?.trim() || 'google';
  const forceRefresh = options.forceRefresh ?? false;

  if (!keyword) {
    return { ideas: [], fromCache: false, cachedAt: null, error: 'Target keyword is required.' };
  }

  if (!forceRefresh) {
    try {
      const cached = await readCacheWithMetadata(
        'keyword_ideas',
        keyword,
        location,
        language,
        device,
        searchEngine
      );

      if (cached !== null) {
        console.log('✅ CACHE HIT - SAVED API CREDITS');

        const ideas = mapKeywordIdeaItems(cached.result);

        if (ideas.length === 0) {
          return {
            ideas: [],
            fromCache: true,
            cachedAt: cached.cachedAt,
            error: 'No keyword ideas were found for this seed keyword.',
          };
        }

        return { ideas, fromCache: true, cachedAt: cached.cachedAt };
      }
    } catch (error) {
      console.error(
        '[fetchKeywordIdeas] Cache lookup failed, falling back to live fetch:',
        error
      );
    }
  }

  console.log('⚠️ CACHE MISS - FETCHING DATAFORSEO');

  const credentials = getDataForSeoCredentials();
  if (!credentials) {
    return {
      ideas: [],
      fromCache: false,
      cachedAt: null,
      error: 'DataForSEO credentials are not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    };
  }

  const gate = await gateResearchLabsLiveFetch();
  if ('error' in gate) {
    return {
      ideas: [],
      fromCache: false,
      cachedAt: null,
      error: gate.error,
    };
  }

  const authToken = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const { response, value: payload } = await withFetchTelemetry(
      {
        integrationType: 'DATAFORSEO',
        targetUrl: DATAFORSEO_KEYWORD_IDEAS_URL,
        workspaceId: gate.workspaceId,
        operation: 'research_keyword_ideas',
        skipCircuitCheck: true,
      },
      async () => {
        const response = await fetch(DATAFORSEO_KEYWORD_IDEAS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              keywords: [keyword],
              location_code: labsLocationCode,
              language_name: language,
              limit: 500,
              include_serp_info: true,
            },
          ]),
        });
        const value = (await response.json()) as DataForSeoResponse;
        return { response, value };
      }
    );

    if (!response.ok) {
      return {
        ideas: [],
        fromCache: false,
        cachedAt: null,
        error: `DataForSEO request failed with status ${response.status}.`,
      };
    }

    const task = payload.tasks?.[0];

    if (!task) {
      return { ideas: [], fromCache: false, cachedAt: null, error: 'DataForSEO returned no task data.' };
    }

    if (task.status_code && task.status_code !== 20000) {
      return {
        ideas: [],
        fromCache: false,
        cachedAt: null,
        error: task.status_message ?? 'DataForSEO returned an error for this keyword.',
      };
    }

    if (isSuccessfulDataForSeoTask(task)) {
      try {
        await setCache(
          'keyword_ideas',
          keyword,
          location,
          language,
          task.result,
          device,
          searchEngine
        );
      } catch (error) {
        console.error('[fetchKeywordIdeas] Cache write failed:', error);
      }
    }

    const ideas = mapKeywordIdeaItems(task.result);

    if (ideas.length === 0) {
      return {
        ideas: [],
        fromCache: false,
        cachedAt: null,
        error: 'No keyword ideas were found for this seed keyword.',
      };
    }

    return { ideas, fromCache: false, cachedAt: new Date().toISOString() };
  } catch (error) {
    console.log('DataForSEO API Error:', error);

    const message =
      error instanceof Error ? error.message : 'Unexpected error while fetching keyword ideas.';

    return { ideas: [], fromCache: false, cachedAt: null, error: message };
  }
}

export async function fetchNamedEntities(
  targetUrl: string,
  seedKeyword: string,
  locationCode: number
): Promise<FetchNamedEntitiesResult> {
  const trimmedUrl = targetUrl.trim();
  const trimmedKeyword = seedKeyword.trim();

  if (!trimmedUrl) {
    return { data: null, error: 'Target URL is required.' };
  }
  if (!trimmedKeyword) {
    return { data: null, error: 'Target keyword is required.' };
  }

  const credentials = getDataForSeoCredentials();
  if (!credentials) {
    return {
      data: null,
      error: 'DataForSEO credentials are not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    };
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return { data: null, error: 'GEMINI_API_KEY is not configured.' };
  }

  const authToken = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
  const targetHostname = normalizeHostname(trimmedUrl);

  try {
    const serpResponse = await fetch(DATAFORSEO_SERP_ORGANIC_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: trimmedKeyword,
          location_code: locationCode,
          language_name: 'English',
          depth: 10,
        },
      ]),
    });

    if (!serpResponse.ok) {
      return {
        data: null,
        error: `DataForSEO SERP request failed with status ${serpResponse.status}.`,
      };
    }

    const serpPayload = (await serpResponse.json()) as { tasks?: SerpTask[] };
    const serpTask = serpPayload.tasks?.[0];

    if (!serpTask) {
      return { data: null, error: 'DataForSEO returned no SERP task data.' };
    }

    if (serpTask.status_code && serpTask.status_code !== 20000) {
      return {
        data: null,
        error: serpTask.status_message ?? 'DataForSEO returned an error for this keyword.',
      };
    }

    const organicItems = (serpTask.result?.[0]?.items ?? []).filter(
      item =>
        item.type === 'organic' &&
        item.title &&
        (item.description || item.title) &&
        normalizeHostname(item.url ?? '') !== targetHostname
    );

    const topCompetitorItems = organicItems.slice(0, 10);
    const { text: competitorText, sourceUrls: competitorSourceUrls } =
      buildCompetitorCorpus(topCompetitorItems);

    if (!competitorText.trim()) {
      return { data: null, error: 'No competitor SERP content was found for this keyword.' };
    }

    let userPageText = '';
    try {
      userPageText = await scrapePageText(trimmedUrl);
    } catch {
      userPageText = '';
    }

    const [competitorAnalysis, userAnalysis] = await Promise.all([
      extractNamedEntitiesFromText(
        competitorText,
        `Competitor SERP content for keyword "${trimmedKeyword}". Each block includes the source URL where the entity was found:`,
        { includeSourceUrls: true, validSourceUrls: competitorSourceUrls }
      ),
      userPageText
        ? extractNamedEntitiesFromText(
            userPageText,
            `User page content at ${trimmedUrl} for keyword "${trimmedKeyword}":`,
            { includeSourceUrls: true, validSourceUrls: [trimmedUrl], defaultSourceUrl: trimmedUrl }
          )
        : Promise.resolve({ entities: [], relationships: [] }),
    ]);

    const entities = dedupeEntities(
      competitorAnalysis.entities
        .map(entity => mapGeminiEntity(entity, competitorSourceUrls))
        .filter(entity => entity.entityName),
      competitorSourceUrls
    );
    const userPageEntities = dedupeEntities(
      userAnalysis.entities
        .map(entity => mapGeminiEntity(entity, [trimmedUrl], trimmedUrl))
        .filter(entity => entity.entityName),
      [trimmedUrl]
    );

    const userEntityNames = new Set(userPageEntities.map(entity => normalizeEntityName(entity.entityName)));

    const competitorOnlyEntities = entities.filter(
      entity => !userEntityNames.has(normalizeEntityName(entity.entityName))
    );

    const entityNames = new Set(entities.map(entity => entity.entityName));
    const relationships: EntityRelationship[] = competitorAnalysis.relationships
      .filter(
        rel =>
          rel.source.trim() &&
          rel.target.trim() &&
          entityNames.has(rel.source.trim()) &&
          entityNames.has(rel.target.trim())
      )
      .map(rel => ({
        source: rel.source.trim(),
        target: rel.target.trim(),
        label: rel.label.trim(),
      }));

    if (entities.length === 0) {
      return { data: null, error: 'No named entities were identified from competitor content.' };
    }

    return {
      data: {
        entities,
        relationships,
        competitorOnlyEntities,
        userPageEntities,
      },
    };
  } catch (error) {
    console.log('Named Entities API Error:', error);

    const message =
      error instanceof Error ? error.message : 'Unexpected error while fetching named entities.';

    return { data: null, error: message };
  }
}

export async function generateNamedEntitySchema(
  entities: NamedEntity[],
  pageUrl: string,
  keyword: string
): Promise<GenerateNamedEntitySchemaResult> {
  const trimmedUrl = pageUrl.trim();
  const trimmedKeyword = keyword.trim();

  if (!trimmedUrl || entities.length === 0) {
    return { schema: '', error: 'Entities and page URL are required for schema generation.' };
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return { schema: '', error: 'GEMINI_API_KEY is not configured.' };
  }

  try {
    const schema = await generateNamedEntitySchemaJsonLd(entities, trimmedUrl, trimmedKeyword);
    return { schema };
  } catch (error) {
    console.log('Schema generation error:', error);

    const message =
      error instanceof Error ? error.message : 'Unexpected error while generating schema markup.';

    return { schema: '', error: message };
  }
}

const RESEARCH_LANGUAGE_LABELS: Record<string, string> = {
  english: 'English',
  malay: 'Malay',
  chinese: 'Chinese',
  indonesian: 'Indonesian',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
};

function languageLabelFromCache(value: string): string {
  return RESEARCH_LANGUAGE_LABELS[value.toLowerCase()] ?? value;
}

export type RecentResearchSearch = {
  keyword: string;
  locationCode: number;
  locationLabel: string;
  language: string;
  cachedAt: string;
};

export async function fetchRecentResearchSearches(): Promise<RecentResearchSearch[]> {
  try {
    const rows = await getPrisma().keywordCache.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        keyword: true,
        location: true,
        language: true,
        createdAt: true,
      },
      take: 200,
    });

    const seen = new Set<string>();
    const results: RecentResearchSearch[] = [];

    for (const row of rows) {
      const dedupeKey = `${row.keyword}|${row.location}|${row.language}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const locationCode = Number(row.location);

      results.push({
        keyword: row.keyword,
        locationCode: Number.isFinite(locationCode) ? locationCode : 2840,
        locationLabel: Number.isFinite(locationCode)
          ? getResearchLocationLabel(locationCode)
          : row.location,
        language: languageLabelFromCache(row.language),
        cachedAt: row.createdAt.toISOString(),
      });

      if (results.length >= 10) break;
    }

    return results;
  } catch (error) {
    console.error('[fetchRecentResearchSearches] Failed to load cache history:', error);
    return [];
  }
}

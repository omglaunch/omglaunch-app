import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';
import { getPrisma } from '@/lib/prisma';
import type { GeogridPlatform } from './types';
import type { MapPackEntry } from './types';
import { businessIdentifiersMatch } from './grid-utils';

export type DataForSeoCredentials = {
  login: string;
  password: string;
};

export async function resolveDataForSeoCredentials(
  workspaceId: string
): Promise<DataForSeoCredentials | null> {
  const config = await getPrisma().integrationConfig.findFirst({
    where: { workspaceId },
    select: { dataForSeoLogin: true, dataForSeoPassword: true },
  });

  const login = config?.dataForSeoLogin?.trim() || process.env.DATAFORSEO_LOGIN?.trim();
  const password = config?.dataForSeoPassword?.trim() || process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) return null;
  return { login, password };
}

export type MapsTaskPayload = {
  keyword: string;
  location_coordinate: string;
  language_code?: string;
  device?: string;
  depth?: number;
  tag?: string;
};

type DataForSeoMapsItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  title?: string;
  cid?: string;
  place_id?: string;
  rating?: { value?: number; votes_count?: number };
  address?: string;
};

type DataForSeoMapsTaskResult = {
  keyword?: string;
  tag?: string;
  items?: DataForSeoMapsItem[];
};

type DataForSeoMapsResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: DataForSeoMapsTaskResult[];
  }>;
};

function resolveMapsEndpoint(platform: GeogridPlatform): string {
  return platform === 'bing'
    ? 'https://api.dataforseo.com/v3/serp/bing/local_pack/live/advanced'
    : 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced';
}

function parseMapPackItems(
  items: DataForSeoMapsItem[] | undefined,
  platform: GeogridPlatform
): MapPackEntry[] {
  if (!items?.length) return [];

  const preferredTypes =
    platform === 'bing'
      ? new Set(['local_pack', 'maps_search'])
      : new Set(['maps_search']);

  const candidates = items.filter(item => {
    if (!item.title?.trim()) return false;
    if (!item.type) return platform === 'google';
    return preferredTypes.has(item.type);
  });

  const source = candidates.length > 0 ? candidates : items.filter(item => item.title?.trim());

  return source
    .slice(0, 3)
    .map((item, index) => ({
      rank: item.rank_group ?? item.rank_absolute ?? index + 1,
      title: item.title ?? 'Unknown',
      cid: item.cid ?? null,
      placeId: item.place_id ?? null,
      rating: item.rating?.value ?? null,
      reviews: item.rating?.votes_count ?? null,
      address: item.address ?? null,
    }));
}

export type ParsedMapsCellResult = {
  tag: string;
  mapPack: MapPackEntry[];
  targetRank: number | null;
  targetCid: string | null;
  targetName: string | null;
};

function parseTaskResult(
  result: DataForSeoMapsTaskResult,
  platform: GeogridPlatform,
  options?: { businessCid?: string; businessName?: string }
): ParsedMapsCellResult {
  const tag = result.tag ?? '';
  const mapPack = parseMapPackItems(result.items, platform);

  let targetRank: number | null = null;
  let targetCid: string | null = null;
  let targetName: string | null = null;

  for (const entry of mapPack) {
    if (businessIdentifiersMatch(entry, options)) {
      targetRank = entry.rank;
      targetCid = entry.cid ?? entry.placeId ?? null;
      targetName = entry.title;
      break;
    }
  }

  return { tag, mapPack, targetRank, targetCid, targetName };
}

async function fetchSingleMapsTask(
  task: MapsTaskPayload,
  credentials: DataForSeoCredentials,
  platform: GeogridPlatform,
  options?: { businessCid?: string; businessName?: string }
): Promise<ParsedMapsCellResult | null> {
  const endpoint = resolveMapsEndpoint(platform);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: buildDataForSeoAuthHeader(credentials),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([task]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO Maps request failed (${response.status})`);
  }

  const payload = (await response.json()) as DataForSeoMapsResponse;
  if (payload.status_code && payload.status_code !== 20_000) {
    throw new Error(payload.status_message ?? 'DataForSEO Maps API error');
  }

  const taskResult = payload.tasks?.[0];
  if (!taskResult) {
    console.warn('[dataforseo-maps] Empty task response');
    return null;
  }

  if (taskResult.status_code && taskResult.status_code !== 20_000) {
    console.warn(
      `[dataforseo-maps] Task failed (${taskResult.status_code}): ${taskResult.status_message ?? 'unknown error'}`
    );
    return null;
  }

  const result = taskResult.result?.[0];
  if (!result) {
    console.warn(
      `[dataforseo-maps] Task returned no result payload (tag: ${task.tag ?? 'unknown'})`
    );
    return null;
  }

  const parsed = parseTaskResult(result, platform, options);
  return {
    ...parsed,
    tag: task.tag ?? parsed.tag,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Fetches each grid cell individually — DataForSEO Live endpoints accept only one task per request.
 * Google: location_coordinate = "latitude,longitude,zoom" (e.g. 3.14,101.69,14z)
 * Bing: location_coordinate = "latitude,longitude"
 */
export async function fetchMapsGeogridBatch(
  tasks: MapsTaskPayload[],
  credentials: DataForSeoCredentials,
  platform: GeogridPlatform,
  options?: { businessCid?: string; businessName?: string }
): Promise<ParsedMapsCellResult[]> {
  const cellResults = await mapWithConcurrency(tasks, 5, task =>
    fetchSingleMapsTask(task, credentials, platform, options)
  );

  const results = cellResults.map((result, index) => {
    const tag = tasks[index]?.tag ?? `${index}`;
    if (result) {
      return { ...result, tag: result.tag || tag };
    }

    return {
      tag,
      mapPack: [],
      targetRank: null,
      targetCid: null,
      targetName: null,
    };
  });

  const failedTasks = cellResults.filter(result => result === null).length;
  const emptyMapPacks = results.filter(result => result.mapPack.length === 0).length;

  if (failedTasks > 0) {
    console.warn(`[dataforseo-maps] ${failedTasks} of ${tasks.length} tasks failed`);
  }

  if (emptyMapPacks === results.length) {
    console.warn('[dataforseo-maps] No map results returned for geogrid batch');
  }

  return results;
}

export type CitationSearchResult = {
  url: string;
  title: string;
  snippet: string;
};

/** DataForSEO Content Analysis — search for brand citations. */
export async function searchBrandCitations(
  brandName: string,
  credentials: DataForSeoCredentials
): Promise<CitationSearchResult[]> {
  const response = await fetch(
    'https://api.dataforseo.com/v3/content_analysis/search/live',
    {
      method: 'POST',
      headers: {
        Authorization: buildDataForSeoAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: brandName,
          search_mode: 'web',
          limit: 20,
        },
      ]),
    }
  );

  if (!response.ok) {
    throw new Error(`DataForSEO Content Analysis failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    tasks?: Array<{
      result?: Array<{
        items?: Array<{ url?: string; title?: string; snippet?: string }>;
      }>;
    }>;
  };

  const items: CitationSearchResult[] = [];
  for (const task of payload.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        if (item.url) {
          items.push({
            url: item.url,
            title: item.title ?? '',
            snippet: item.snippet ?? '',
          });
        }
      }
    }
  }
  return items;
}

import { getPrisma } from '@/lib/prisma';
import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';
import { withFetchTelemetry } from '@/lib/admin/integration-telemetry';
import { assertIntegrationEnabled } from '@/lib/admin/circuit-breaker';
import {
  assertLabsBudget,
  estimateLabsTasksForRankedKeywords,
} from '@/lib/silo-builder/labs-budget';
import { ZERO_COMPETITOR_KEYWORDS_ERROR } from '@/lib/silo-builder/constants';

export { ZERO_COMPETITOR_KEYWORDS_ERROR };

export const DATAFORSEO_RANKED_KEYWORDS_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live';

export function isZeroCompetitorKeywordsError(
  error: unknown
): error is Error & { name: typeof ZERO_COMPETITOR_KEYWORDS_ERROR } {
  return error instanceof Error && error.name === ZERO_COMPETITOR_KEYWORDS_ERROR;
}

type DataForSeoCredentials = {
  login: string;
  password: string;
};

export type RankedKeywordRow = {
  keyword: string;
  searchVolume: number | null;
  rank: number | null;
};

type RankedKeywordItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      keyword?: string;
      search_volume?: number;
    };
  };
  ranked_serp_element?: {
    serp_item?: {
      rank_absolute?: number;
    };
  };
};

type RankedKeywordsTask = {
  status_code?: number;
  status_message?: string;
  result?: Array<{
    items?: RankedKeywordItem[];
  }>;
};

function getEnvCredentials(): DataForSeoCredentials | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;
  return { login, password };
}

async function getIntegrationCredentials(
  workspaceId?: string
): Promise<DataForSeoCredentials | null> {
  if (!workspaceId?.trim()) return getEnvCredentials();

  const integration = await getPrisma().integrationConfig.findFirst({
    where: { workspaceId },
    select: { dataForSeoLogin: true, dataForSeoPassword: true },
  });

  const login = integration?.dataForSeoLogin?.trim();
  const password = integration?.dataForSeoPassword?.trim();
  if (login && password) return { login, password };

  return getEnvCredentials();
}

export async function workspaceHasOwnDataForSeoCredentials(
  workspaceId: string
): Promise<boolean> {
  const integration = await getPrisma().integrationConfig.findFirst({
    where: { workspaceId },
    select: { dataForSeoLogin: true, dataForSeoPassword: true },
  });
  return Boolean(
    integration?.dataForSeoLogin?.trim() && integration?.dataForSeoPassword?.trim()
  );
}

function extractKeyword(item: RankedKeywordItem): string | null {
  return (
    item.keyword_data?.keyword?.trim() ??
    item.keyword_data?.keyword_info?.keyword?.trim() ??
    null
  );
}

function pruneItems(items: RankedKeywordItem[] | undefined): RankedKeywordRow[] {
  if (!items?.length) return [];

  const rows: RankedKeywordRow[] = [];
  for (const item of items) {
    const keyword = extractKeyword(item);
    if (!keyword) continue;

    rows.push({
      keyword,
      searchVolume:
        typeof item.keyword_data?.keyword_info?.search_volume === 'number'
          ? item.keyword_data.keyword_info.search_volume
          : null,
      rank:
        typeof item.ranked_serp_element?.serp_item?.rank_absolute === 'number'
          ? item.ranked_serp_element.serp_item.rank_absolute
          : null,
    });
  }

  return rows.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
}

export async function fetchSiloCompetitorRankedKeywords(
  targetDomain: string,
  geography: string,
  workspaceId: string,
  limit = 300
): Promise<RankedKeywordRow[]> {
  await assertIntegrationEnabled('DATAFORSEO');
  await assertLabsBudget(workspaceId, estimateLabsTasksForRankedKeywords());

  const credentials = await getIntegrationCredentials(workspaceId);
  if (!credentials) {
    throw new Error('DataForSEO credentials are not configured.');
  }

  const { response, value: payload } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_RANKED_KEYWORDS_URL,
      workspaceId,
      operation: 'silo_competitor_ranked_keywords',
    },
    async () => {
      const response = await fetch(DATAFORSEO_RANKED_KEYWORDS_URL, {
        method: 'POST',
        headers: {
          Authorization: buildDataForSeoAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            target: targetDomain.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
            location_name: geography,
            language_name: 'English',
            limit,
          },
        ]),
      });

      const value = (await response.json()) as { tasks?: RankedKeywordsTask[] };
      return { response, value };
    }
  );

  if (!response.ok) {
    throw new Error(`DataForSEO ranked keywords failed with HTTP ${response.status}.`);
  }

  const task = payload.tasks?.[0];
  if (!task || (task.status_code && task.status_code !== 20000)) {
    throw new Error(task?.status_message || 'DataForSEO ranked keywords task failed.');
  }

  const pruned = pruneItems(task.result?.[0]?.items);
  const rawItemCount = task.result?.[0]?.items?.length ?? 0;

  if (pruned.length === 0) {
    const error = new Error(
      rawItemCount > 0
        ? `DataForSEO returned ${rawItemCount} keywords for ${targetDomain} in ${geography}, but none could be parsed. Please contact support.`
        : `No ranked keywords found for ${targetDomain} in ${geography}. The domain may be too new or obscure.`
    );
    error.name = ZERO_COMPETITOR_KEYWORDS_ERROR;
    throw error;
  }

  return pruned;
}

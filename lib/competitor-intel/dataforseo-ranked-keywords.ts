import { getPrisma } from '@/lib/prisma';
import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';
import { withFetchTelemetry } from '@/lib/admin/integration-telemetry';
import { assertIntegrationEnabled } from '@/lib/admin/circuit-breaker';
import {
  assertLabsBudget,
  estimateLabsTasksForRankedKeywords,
} from '@/lib/silo-builder/labs-budget';
import type { PrunedCompetitorKeyword } from '@/lib/competitor-intel/types';

export const DATAFORSEO_RANKED_KEYWORDS_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live';

export const ZERO_COMPETITOR_KEYWORDS_ERROR = 'ZERO_COMPETITOR_KEYWORDS';

type DataForSeoCredentials = {
  login: string;
  password: string;
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

function extractKeyword(item: RankedKeywordItem): string | null {
  const fromKeywordData = item.keyword_data?.keyword?.trim();
  if (fromKeywordData) {
    return fromKeywordData;
  }

  return item.keyword_data?.keyword_info?.keyword?.trim() ?? null;
}

function pruneRankedKeywordItems(items: RankedKeywordItem[] | undefined): PrunedCompetitorKeyword[] {
  if (!items?.length) {
    return [];
  }

  const pruned: PrunedCompetitorKeyword[] = [];

  for (const item of items) {
    const keyword = extractKeyword(item);
    if (!keyword) {
      continue;
    }

    const searchVolume =
      typeof item.keyword_data?.keyword_info?.search_volume === 'number'
        ? item.keyword_data.keyword_info.search_volume
        : null;

    const rank =
      typeof item.ranked_serp_element?.serp_item?.rank_absolute === 'number'
        ? item.ranked_serp_element.serp_item.rank_absolute
        : null;

    pruned.push({ keyword, searchVolume, rank });
  }

  return pruned;
}

export async function fetchCompetitorRankedKeywords(
  targetDomain: string,
  targetCountry: string,
  workspaceId?: string,
  limit = 500
): Promise<PrunedCompetitorKeyword[]> {
  if (workspaceId?.trim()) {
    await assertIntegrationEnabled('DATAFORSEO');
    await assertLabsBudget(workspaceId, estimateLabsTasksForRankedKeywords());
  }

  const credentials = await getIntegrationCredentials(workspaceId);
  if (!credentials) {
    throw new Error('DataForSEO credentials are not configured.');
  }

  const { response, value: payload } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_RANKED_KEYWORDS_URL,
      workspaceId,
      operation: 'competitor_ranked_keywords',
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
            target: targetDomain,
            location_name: targetCountry,
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
    throw new Error(`DataForSEO ranked keywords request failed with HTTP ${response.status}.`);
  }

  const task = payload.tasks?.[0];
  if (!task || (task.status_code && task.status_code !== 20000)) {
    throw new Error(
      task?.status_message || 'DataForSEO ranked keywords task returned an error.'
    );
  }

  const pruned = pruneRankedKeywordItems(task.result?.[0]?.items);
  const rawItemCount = task.result?.[0]?.items?.length ?? 0;

  if (pruned.length === 0) {
    const error = new Error(
      rawItemCount > 0
        ? `DataForSEO returned ${rawItemCount} keywords for ${targetDomain} in ${targetCountry}, but none could be parsed. Please contact support.`
        : `No ranked keywords found for ${targetDomain} in ${targetCountry}. The domain may be too new or obscure.`
    );
    error.name = ZERO_COMPETITOR_KEYWORDS_ERROR;
    throw error;
  }

  return pruned;
}

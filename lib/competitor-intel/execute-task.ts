import { GoogleGenAI } from '@google/genai';
import { getPrisma } from '@/lib/prisma';
import {
  deductCredits,
  INSUFFICIENT_CREDITS_ERROR,
} from '@/lib/credits';
import {
  completeBackgroundTask,
  trackBackgroundTask,
} from '@/lib/admin/integration-logging';
import { fetchClusterKeywordMetricsBatch } from '@/lib/topical-map/dataforseo-metrics';
import { saveTopicalMap } from '@/lib/topical-map/persistence';
import type { HubSpokeMap } from '@/lib/hub-spoke-data';
import {
  assertLabsBudget,
  estimateLabsTasksForKeywords,
} from '@/lib/silo-builder/labs-budget';
import {
  REVERSE_ENGINEER_CREDIT_COST,
  REVERSE_ENGINEER_TASK_TYPE,
  type ReverseEngineerProgressStep,
} from '@/lib/competitor-intel/constants';
import {
  fetchCompetitorRankedKeywords,
  ZERO_COMPETITOR_KEYWORDS_ERROR,
} from '@/lib/competitor-intel/dataforseo-ranked-keywords';
import { generateCompetitorAttackMap } from '@/lib/competitor-intel/generate-attack-map';
import { sanitizeTargetDomain, isValidSanitizedDomain } from '@/lib/competitor-intel/sanitize-domain';
import type {
  CompetitorIntelResult,
  ReverseEngineerTaskMetadata,
  SemanticGap,
} from '@/lib/competitor-intel/types';

export type ReverseEngineerJobParams = {
  targetDomain: string;
  coreNiche: string;
  targetCountry: string;
  workspaceId: string;
  userId: string;
};

async function updateTaskProgress(
  taskId: string,
  step: ReverseEngineerProgressStep,
  extra: Partial<ReverseEngineerTaskMetadata> = {}
): Promise<void> {
  try {
    const task = await getPrisma().backgroundQueueTask.findUnique({
      where: { id: taskId },
      select: { metadata: true },
    });

    const existing =
      typeof task?.metadata === 'object' && task.metadata !== null
        ? (task.metadata as ReverseEngineerTaskMetadata)
        : {};

    await getPrisma().backgroundQueueTask.update({
      where: { id: taskId },
      data: {
        metadata: {
          ...existing,
          ...extra,
          step,
        },
      },
    });
  } catch (error) {
    console.error('[reverse-engineer] Failed to update task progress:', error);
  }
}

async function enrichMapWithMetrics(
  map: HubSpokeMap,
  location: string,
  workspaceId: string
): Promise<HubSpokeMap> {
  const keywords = map.clusters.map(cluster => cluster.targetKeyword);
  await assertLabsBudget(
    workspaceId,
    estimateLabsTasksForKeywords(keywords.length)
  );
  const metricsByKeyword = await fetchClusterKeywordMetricsBatch(
    keywords,
    location,
    workspaceId
  );

  return {
    ...map,
    clusters: map.clusters.map(cluster => {
      const metrics = metricsByKeyword.get(cluster.targetKeyword) ?? {
        searchVolume: null,
        keywordDifficulty: null,
      };

      return {
        ...cluster,
        searchVolume: metrics.searchVolume,
        keywordDifficulty: metrics.keywordDifficulty,
        status: 'Draft' as const,
      };
    }),
  };
}

export async function runReverseEngineerPipeline(
  taskId: string,
  params: ReverseEngineerJobParams
): Promise<CompetitorIntelResult> {
  const competitorDomain = sanitizeTargetDomain(params.targetDomain);

  if (!isValidSanitizedDomain(competitorDomain)) {
    throw new Error('Enter a valid competitor domain (e.g. competitor.com).');
  }

  const coreNiche = params.coreNiche.trim();
  if (!coreNiche) {
    throw new Error('coreNiche is required.');
  }

  await updateTaskProgress(taskId, 'scraping', {
    targetDomain: params.targetDomain,
    coreNiche,
    targetCountry: params.targetCountry,
    workspaceId: params.workspaceId,
    competitorDomain,
  });

  const keywords = await fetchCompetitorRankedKeywords(
    competitorDomain,
    params.targetCountry,
    params.workspaceId
  );

  await deductCredits(
    params.userId,
    REVERSE_ENGINEER_CREDIT_COST,
    'COMPETITOR_REVERSE_ENGINEER'
  );

  await updateTaskProgress(taskId, 'analyzing', {
    keywordsAnalyzed: keywords.length,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  await updateTaskProgress(taskId, 'architecting');

  const ai = new GoogleGenAI({ apiKey });
  const generated = await generateCompetitorAttackMap(ai, {
    coreNiche,
    competitorDomain,
    targetCountry: params.targetCountry,
    keywords,
    workspaceId: params.workspaceId,
  });

  if (!generated) {
    throw new Error(
      'Gemini did not return a valid attack map. Please try again.'
    );
  }

  const enrichedMap = await enrichMapWithMetrics(
    generated.map,
    params.targetCountry,
    params.workspaceId
  );

  await updateTaskProgress(taskId, 'saving', {
    semanticGaps: generated.semanticGaps,
    keywordsAnalyzed: keywords.length,
  });

  const seedKeyword = `${coreNiche} vs ${competitorDomain}`;

  let saved;
  try {
    saved = await saveTopicalMap(
      params.workspaceId,
      seedKeyword,
      params.targetCountry,
      enrichedMap,
      {
        source: 'COMPETITOR_INTEL',
        competitorDomain,
        coreNiche,
        semanticGaps: generated.semanticGaps,
        keywordsAnalyzed: keywords.length,
      }
    );
  } catch (saveError) {
    const detail =
      saveError instanceof Error ? saveError.message : 'Unknown database error';
    throw new Error(
      `Attack map was generated but could not be saved. Stop the dev server, run "npm run dev:clean", then try again. (${detail})`
    );
  }

  await updateTaskProgress(taskId, 'complete', {
    mapId: saved.id,
    semanticGaps: generated.semanticGaps,
    keywordsAnalyzed: keywords.length,
    competitorDomain,
  });

  return {
    map: enrichedMap,
    semanticGaps: generated.semanticGaps,
    competitorDomain,
    coreNiche,
    targetCountry: params.targetCountry,
    keywordsAnalyzed: keywords.length,
    mapId: saved.id,
  };
}

export async function createReverseEngineerTask(
  params: ReverseEngineerJobParams
): Promise<string | null> {
  return trackBackgroundTask({
    userId: params.userId,
    taskType: REVERSE_ENGINEER_TASK_TYPE,
    metadata: {
      step: 'queued',
      targetDomain: params.targetDomain,
      coreNiche: params.coreNiche,
      targetCountry: params.targetCountry,
      workspaceId: params.workspaceId,
      competitorDomain: sanitizeTargetDomain(params.targetDomain),
    } satisfies ReverseEngineerTaskMetadata,
  });
}

export async function markReverseEngineerTaskFailed(
  taskId: string | null | undefined,
  error: unknown
): Promise<void> {
  if (!taskId) {
    return;
  }

  const errorMessage = error instanceof Error ? error.message : 'Reverse-engineer task failed.';
  const errorCode =
    error instanceof Error && error.name === ZERO_COMPETITOR_KEYWORDS_ERROR
      ? ZERO_COMPETITOR_KEYWORDS_ERROR
      : error instanceof Error && error.message === INSUFFICIENT_CREDITS_ERROR
        ? INSUFFICIENT_CREDITS_ERROR
        : 'TASK_FAILED';

  try {
    const task = await getPrisma().backgroundQueueTask.findUnique({
      where: { id: taskId },
      select: { metadata: true },
    });

    const existing =
      typeof task?.metadata === 'object' && task.metadata !== null
        ? (task.metadata as ReverseEngineerTaskMetadata)
        : {};

    await getPrisma().backgroundQueueTask.update({
      where: { id: taskId },
      data: {
        metadata: {
          ...existing,
          errorCode,
          errorMessage,
        },
      },
    });
  } catch (updateError) {
    console.error('[reverse-engineer] Failed to persist task error metadata:', updateError);
  }

  await completeBackgroundTask(taskId, 'FAILED');
}

export async function markReverseEngineerTaskCompleted(taskId: string): Promise<void> {
  await completeBackgroundTask(taskId, 'COMPLETED');
}

export function parseTaskMetadata(metadata: unknown): ReverseEngineerTaskMetadata {
  if (typeof metadata !== 'object' || metadata === null) {
    return { step: 'queued' };
  }

  return metadata as ReverseEngineerTaskMetadata;
}

export function isSemanticGapArray(value: unknown): value is SemanticGap[] {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SemanticGap).topic === 'string' &&
        typeof (item as SemanticGap).rationale === 'string'
    )
  );
}

export async function assertSufficientCredits(userId: string, cost: number): Promise<void> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user || user.credits < cost) {
    throw new Error(INSUFFICIENT_CREDITS_ERROR);
  }
}

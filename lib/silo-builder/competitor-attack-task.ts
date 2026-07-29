import { getPrisma } from '@/lib/prisma';
import {
  deductCredits,
  INSUFFICIENT_CREDITS_ERROR,
} from '@/lib/credits';
import {
  completeBackgroundTask,
  trackBackgroundTask,
} from '@/lib/admin/integration-logging';
import {
  REVERSE_ENGINEER_PROGRESS_LABELS,
  type ReverseEngineerProgressStep,
} from '@/lib/competitor-intel/constants';
import { generateCompetitorAttackMap } from '@/lib/silo-builder/competitor-engine';
import {
  fetchSiloCompetitorRankedKeywords,
  isZeroCompetitorKeywordsError,
} from '@/lib/silo-builder/dataforseo-ranked';
import {
  SILO_COMPETITOR_ATTACK_CREDIT_COST,
  SILO_COMPETITOR_ATTACK_TASK_TYPE,
  ZERO_COMPETITOR_KEYWORDS_ERROR,
} from '@/lib/silo-builder/constants';
import { fetchProjectWithNodes, persistCompetitorSiloProject } from '@/lib/silo-builder/persist';
import { progressiveEnrichSiloProjectMetrics } from '@/lib/silo-builder/enrich-metrics';
import type { SiloProjectDto } from '@/lib/silo-builder/types';

export type SiloCompetitorAttackTaskMetadata = {
  step: ReverseEngineerProgressStep;
  domain: string;
  geography: string;
  niche: string;
  workspaceId: string;
  integrationId?: string;
  title?: string;
  projectId?: string;
  keywordsAnalyzed?: number;
  usesCredits?: boolean;
  hasOwnDataForSeo?: boolean;
  errorCode?: string;
  errorMessage?: string;
};

export type SiloCompetitorAttackJobParams = {
  domain: string;
  geography: string;
  niche: string;
  workspaceId: string;
  userId: string;
  integrationId?: string;
  title?: string;
  usesCredits: boolean;
  hasOwnDataForSeo: boolean;
};

export type SiloCompetitorAttackResult = {
  project: SiloProjectDto;
  domain: string;
  geography: string;
  niche: string;
  keywordsAnalyzed: number;
  projectId: string;
};

async function updateTaskProgress(
  taskId: string,
  step: ReverseEngineerProgressStep,
  extra: Partial<SiloCompetitorAttackTaskMetadata> = {}
): Promise<void> {
  try {
    const task = await getPrisma().backgroundQueueTask.findUnique({
      where: { id: taskId },
      select: { metadata: true },
    });

    const existing =
      typeof task?.metadata === 'object' && task.metadata !== null
        ? (task.metadata as SiloCompetitorAttackTaskMetadata)
        : ({} as SiloCompetitorAttackTaskMetadata);

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
    console.error('[silo-competitor-attack] Failed to update task progress:', error);
  }
}

export async function runSiloCompetitorAttackPipeline(
  taskId: string,
  params: SiloCompetitorAttackJobParams
): Promise<SiloCompetitorAttackResult> {
  const domain = params.domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const geography = params.geography.trim() || 'Malaysia';
  const niche = params.niche.trim();

  await updateTaskProgress(taskId, 'scraping', {
    domain,
    geography,
    niche,
    workspaceId: params.workspaceId,
    integrationId: params.integrationId,
    title: params.title,
    usesCredits: params.usesCredits,
    hasOwnDataForSeo: params.hasOwnDataForSeo,
  });

  const rankedKeywords = await fetchSiloCompetitorRankedKeywords(
    domain,
    geography,
    params.workspaceId
  );

  if (params.usesCredits) {
    await deductCredits(
      params.userId,
      SILO_COMPETITOR_ATTACK_CREDIT_COST,
      'SILO_COMPETITOR_ATTACK'
    );
  } else if (!params.hasOwnDataForSeo) {
    await deductCredits(
      params.userId,
      SILO_COMPETITOR_ATTACK_CREDIT_COST,
      'SILO_COMPETITOR_ATTACK_DATAFORSEO'
    );
  }

  await updateTaskProgress(taskId, 'analyzing', {
    keywordsAnalyzed: rankedKeywords.length,
  });

  await updateTaskProgress(taskId, 'architecting');

  const map = await generateCompetitorAttackMap(
    params.workspaceId,
    domain,
    geography,
    niche,
    rankedKeywords
  );

  await updateTaskProgress(taskId, 'saving', {
    keywordsAnalyzed: rankedKeywords.length,
  });

  const project = await persistCompetitorSiloProject(
    {
      userId: params.userId,
      workspaceId: params.workspaceId,
      integrationId: params.integrationId,
      type: 'COMPETITOR',
      title: params.title?.trim() || `Attack Map: ${domain}`,
      domain,
      geography,
      niche,
    },
    map
  );

  await updateTaskProgress(taskId, 'enriching', {
    projectId: project.id,
    keywordsAnalyzed: rankedKeywords.length,
  });

  await progressiveEnrichSiloProjectMetrics(project.id, params.workspaceId);

  const enrichedProject =
    (await fetchProjectWithNodes(project.id, params.workspaceId, params.userId)) ??
    project;

  await updateTaskProgress(taskId, 'complete', {
    projectId: enrichedProject.id,
    keywordsAnalyzed: rankedKeywords.length,
  });

  return {
    project: enrichedProject,
    domain,
    geography,
    niche,
    keywordsAnalyzed: rankedKeywords.length,
    projectId: enrichedProject.id,
  };
}

export async function createSiloCompetitorAttackTask(
  params: SiloCompetitorAttackJobParams
): Promise<string | null> {
  return trackBackgroundTask({
    userId: params.userId,
    taskType: SILO_COMPETITOR_ATTACK_TASK_TYPE,
    metadata: {
      step: 'queued',
      domain: params.domain,
      geography: params.geography,
      niche: params.niche,
      workspaceId: params.workspaceId,
      integrationId: params.integrationId,
      title: params.title,
      usesCredits: params.usesCredits,
      hasOwnDataForSeo: params.hasOwnDataForSeo,
    } satisfies SiloCompetitorAttackTaskMetadata,
  });
}

export async function markSiloCompetitorAttackTaskFailed(
  taskId: string | null | undefined,
  error: unknown
): Promise<void> {
  if (!taskId) {
    return;
  }

  const errorMessage =
    error instanceof Error ? error.message : 'Competitor attack task failed.';
  const errorCode = isZeroCompetitorKeywordsError(error)
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
        ? (task.metadata as SiloCompetitorAttackTaskMetadata)
        : ({} as SiloCompetitorAttackTaskMetadata);

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
    console.error(
      '[silo-competitor-attack] Failed to persist task error metadata:',
      updateError
    );
  }

  await completeBackgroundTask(taskId, 'FAILED');
}

export async function markSiloCompetitorAttackTaskCompleted(taskId: string): Promise<void> {
  await completeBackgroundTask(taskId, 'COMPLETED');
}

export function parseSiloCompetitorAttackTaskMetadata(
  metadata: unknown
): SiloCompetitorAttackTaskMetadata {
  if (typeof metadata !== 'object' || metadata === null) {
    return {
      step: 'queued',
      domain: '',
      geography: '',
      niche: '',
      workspaceId: '',
    };
  }

  return metadata as SiloCompetitorAttackTaskMetadata;
}

export async function loadCompletedSiloCompetitorAttackProject(
  projectId: string,
  workspaceId: string,
  actingUserId?: string
): Promise<SiloProjectDto | null> {
  return fetchProjectWithNodes(projectId, workspaceId, actingUserId);
}

export { REVERSE_ENGINEER_PROGRESS_LABELS };

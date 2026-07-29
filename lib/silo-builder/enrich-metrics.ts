import type { RankedKeywordRow } from '@/lib/silo-builder/dataforseo-ranked';
import { enrichKeywordsWithMetrics } from '@/lib/silo-builder/enrich-node-metrics';
import { getPrisma } from '@/lib/prisma';
import {
  assertSiloLabsBudget,
  estimateLabsTasksForKeywords,
  isLabsBudgetExceededError,
} from '@/lib/silo-builder/labs-budget';
import { assertIntegrationEnabled } from '@/lib/admin/circuit-breaker';
import {
  computeSiloMetricsStatusSummary,
  nodeNeedsMetrics,
  type SiloMetricsStatus,
} from '@/lib/silo-builder/metrics';
import {
  SILO_METRICS_ENRICH_CHUNK_SIZE,
  SILO_METRICS_ENRICH_LOCK_STALE_MS,
} from '@/lib/silo-builder/constants';
import { parseRankedKeywords } from '@/lib/silo-builder/ranked-keywords';
import type { SiloNodeDto, SiloNodeGraphItem } from '@/lib/silo-builder/types';

type MapWithMetrics = {
  pillar: SiloNodeGraphItem;
  spokes: SiloNodeGraphItem[];
};

export { countNodesNeedingMetrics, nodeNeedsMetrics } from '@/lib/silo-builder/metrics';

export class EnrichInProgressError extends Error {
  constructor(projectId: string) {
    super(
      `Metrics enrich is already running for this project (${projectId}). Wait for it to finish, then try again.`
    );
    this.name = 'EnrichInProgressError';
  }
}

export function isEnrichInProgressError(
  error: unknown
): error is EnrichInProgressError {
  return error instanceof EnrichInProgressError;
}

function applyMetricsMeta(
  item: SiloNodeGraphItem,
  rawKeyword: string,
  enriched: Awaited<ReturnType<typeof enrichKeywordsWithMetrics>>
): SiloNodeGraphItem {
  const meta = enriched.get(rawKeyword);
  if (!meta) {
    return item;
  }

  return {
    ...item,
    targetKeyword: meta.targetKeyword,
    searchVolume: meta.searchVolume,
    difficulty: meta.difficulty,
    originalTargetKeyword: meta.originalTargetKeyword,
    keywordSource: meta.keywordSource,
    metricsConfidence: meta.metricsConfidence,
  };
}

function chunkNodes<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Acquire a project-level enrich lock via metricsStatus=enriching.
 * Returns false if another enrich is already in progress (and not stale).
 */
export async function tryAcquireSiloMetricsEnrichLock(
  projectId: string
): Promise<boolean> {
  const prisma = getPrisma();
  const staleCutoff = new Date(Date.now() - SILO_METRICS_ENRICH_LOCK_STALE_MS);

  const result = await prisma.siloProject.updateMany({
    where: {
      id: projectId,
      OR: [
        { metricsStatus: { not: 'enriching' } },
        { metricsStatus: null },
        { metricsStatus: 'enriching', updatedAt: { lt: staleCutoff } },
      ],
    },
    data: { metricsStatus: 'enriching' },
  });

  return result.count > 0;
}

export async function enrichSiloMapWithMetrics(
  map: MapWithMetrics,
  location: string,
  workspaceId: string,
  competitorKeywords: RankedKeywordRow[] = []
): Promise<MapWithMetrics> {
  const rawKeywords = [
    map.pillar.targetKeyword,
    ...map.spokes.map(spoke => spoke.targetKeyword),
  ].filter(Boolean);

  await assertIntegrationEnabled('DATAFORSEO');
  await assertSiloLabsBudget(
    workspaceId,
    estimateLabsTasksForKeywords(rawKeywords.length)
  );

  const enriched = await enrichKeywordsWithMetrics({
    rawKeywords,
    location,
    workspaceId,
    competitorKeywords,
  });

  return {
    pillar: applyMetricsMeta(map.pillar, map.pillar.targetKeyword, enriched),
    spokes: map.spokes.map(spoke =>
      applyMetricsMeta(spoke, spoke.targetKeyword, enriched)
    ),
  };
}

export async function syncSiloProjectMetricsStatus(
  projectId: string,
  nodes: SiloNodeDto[],
  options?: {
    markFailed?: boolean;
    enrichedAt?: Date;
    forceStatus?: SiloMetricsStatus;
  }
): Promise<void> {
  const prisma = getPrisma();
  const summary = computeSiloMetricsStatusSummary(
    nodes,
    options?.enrichedAt?.toISOString() ?? null,
    options?.forceStatus
  );
  const status = options?.markFailed
    ? 'failed'
    : options?.forceStatus === 'enriching' &&
        summary.completeCount < summary.totalCount
      ? 'enriching'
      : summary.status;
  const enrichedAt = options?.enrichedAt ?? new Date();

  await prisma.siloProject.update({
    where: { id: projectId },
    data: {
      metricsStatus: status,
      metricsCompleteCount: summary.completeCount,
      metricsTotalCount: summary.totalCount,
      metricsEnrichedAt:
        summary.totalCount > 0 || options?.markFailed ? enrichedAt : null,
    },
  });
}

type BackfillOptions = {
  force?: boolean;
  /** Limit enrich to these node ids (progressive chunks). */
  nodeIds?: string[];
  skipBudgetCheck?: boolean;
};

/**
 * Persist Labs metrics for silo nodes.
 * - force=false: only nodes missing volume/KD/confidence (Tier-1 safe path)
 * - force=true: all nodes with a target keyword (bypasses Labs cache)
 * Always batches into Labs overview (+ optional bulk KD), never N×1-keyword tasks.
 */
export async function backfillSiloNodeMetricsIfNeeded(
  nodes: SiloNodeDto[],
  geography: string | null,
  workspaceId: string,
  competitorKeywords: RankedKeywordRow[] = [],
  options: boolean | BackfillOptions = false
): Promise<SiloNodeDto[]> {
  const opts: BackfillOptions =
    typeof options === 'boolean' ? { force: options } : options;
  const force = opts.force === true;

  let targets = force
    ? nodes.filter(node => Boolean(node.targetKeyword?.trim()))
    : nodes.filter(nodeNeedsMetrics);

  if (opts.nodeIds && opts.nodeIds.length > 0) {
    const allowed = new Set(opts.nodeIds);
    targets = targets.filter(node => allowed.has(node.id));
  }

  if (targets.length === 0) {
    return nodes;
  }

  if (!opts.skipBudgetCheck) {
    await assertIntegrationEnabled('DATAFORSEO');
    await assertSiloLabsBudget(
      workspaceId,
      estimateLabsTasksForKeywords(targets.length)
    );
  }

  const location = geography?.trim() || 'Malaysia';
  const prisma = getPrisma();
  const projectId = targets[0]?.projectId ?? nodes[0]?.projectId;
  const enrichedAt = new Date();
  const enrichedAtIso = enrichedAt.toISOString();

  const rawKeywords = targets.map(
    node => node.originalTargetKeyword ?? node.targetKeyword!
  );

  let enriched: Awaited<ReturnType<typeof enrichKeywordsWithMetrics>>;
  try {
    enriched = await enrichKeywordsWithMetrics({
      rawKeywords,
      location,
      workspaceId,
      competitorKeywords,
      forceRefresh: force,
    });
  } catch (error) {
    if (projectId) {
      await syncSiloProjectMetricsStatus(projectId, nodes, {
        markFailed: true,
        enrichedAt,
      });
    }
    throw error;
  }

  const byId = new Map(nodes.map(node => [node.id, node]));

  for (const node of targets) {
    const rawKeyword = node.originalTargetKeyword ?? node.targetKeyword!;
    const meta = enriched.get(rawKeyword);
    if (!meta) {
      continue;
    }

    const hasChanges =
      node.targetKeyword !== meta.targetKeyword ||
      node.searchVolume !== meta.searchVolume ||
      node.difficulty !== meta.difficulty ||
      node.originalTargetKeyword !== meta.originalTargetKeyword ||
      node.keywordSource !== meta.keywordSource ||
      node.metricsConfidence !== meta.metricsConfidence;

    if (!hasChanges && !force) {
      if (!node.enrichedAt) {
        await prisma.siloNode.update({
          where: { id: node.id },
          data: { enrichedAt },
        });
        byId.set(node.id, { ...node, enrichedAt: enrichedAtIso });
      }
      continue;
    }

    await prisma.siloNode.update({
      where: { id: node.id },
      data: {
        targetKeyword: meta.targetKeyword,
        originalTargetKeyword: meta.originalTargetKeyword,
        keywordSource: meta.keywordSource,
        metricsConfidence: meta.metricsConfidence,
        searchVolume: meta.searchVolume,
        difficulty: meta.difficulty,
        enrichedAt,
      },
    });

    byId.set(node.id, {
      ...node,
      targetKeyword: meta.targetKeyword,
      originalTargetKeyword: meta.originalTargetKeyword,
      keywordSource: meta.keywordSource,
      metricsConfidence: meta.metricsConfidence,
      searchVolume: meta.searchVolume,
      difficulty: meta.difficulty,
      enrichedAt: enrichedAtIso,
    });
  }

  const updatedNodes = nodes.map(node => byId.get(node.id) ?? node);

  if (projectId) {
    const stillMissing = updatedNodes.some(nodeNeedsMetrics);
    await syncSiloProjectMetricsStatus(projectId, updatedNodes, {
      enrichedAt,
      forceStatus: stillMissing ? 'enriching' : undefined,
    });
  }

  return updatedNodes;
}

/**
 * Enrich missing metrics in chunks aligned to Labs overview batch size (100).
 * Acquires a project enrich lock so concurrent refresh/generate cannot double-spend.
 */
export async function progressiveEnrichSiloProjectMetrics(
  projectId: string,
  workspaceId: string,
  options?: { force?: boolean }
): Promise<SiloNodeDto[]> {
  const prisma = getPrisma();
  const force = options?.force === true;

  const project = await prisma.siloProject.findFirst({
    where: { id: projectId, workspaceId },
    include: { nodes: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const rankedKeywords = parseRankedKeywords(project.rankedKeywords);
  const { toNodeDto } = await import('@/lib/silo-builder/persist');
  let nodes = project.nodes.map(toNodeDto);

  const targets = force
    ? nodes.filter(node => Boolean(node.targetKeyword?.trim()))
    : nodes.filter(nodeNeedsMetrics);

  if (targets.length === 0) {
    await syncSiloProjectMetricsStatus(projectId, nodes);
    return nodes;
  }

  const locked = await tryAcquireSiloMetricsEnrichLock(projectId);
  if (!locked) {
    throw new EnrichInProgressError(projectId);
  }

  try {
    await assertIntegrationEnabled('DATAFORSEO');
    await assertSiloLabsBudget(
      workspaceId,
      estimateLabsTasksForKeywords(targets.length)
    );
  } catch (error) {
    if (isLabsBudgetExceededError(error)) {
      await syncSiloProjectMetricsStatus(projectId, nodes, {
        markFailed: true,
      });
    } else {
      // Release lock on circuit/other failures before enrich starts.
      await syncSiloProjectMetricsStatus(projectId, nodes);
    }
    throw error;
  }

  // Lock already set metricsStatus=enriching; refresh counts.
  await syncSiloProjectMetricsStatus(projectId, nodes, {
    forceStatus: 'enriching',
  });

  const chunks = chunkNodes(targets, SILO_METRICS_ENRICH_CHUNK_SIZE);

  try {
    for (const chunk of chunks) {
      nodes = await backfillSiloNodeMetricsIfNeeded(
        nodes,
        project.geography,
        workspaceId,
        rankedKeywords,
        {
          force,
          nodeIds: chunk.map(node => node.id),
          skipBudgetCheck: true,
        }
      );
    }

    const summary = computeSiloMetricsStatusSummary(nodes);
    await syncSiloProjectMetricsStatus(projectId, nodes, {
      forceStatus: summary.status === 'complete' ? 'complete' : summary.status,
    });

    return nodes;
  } catch (error) {
    await syncSiloProjectMetricsStatus(projectId, nodes, {
      markFailed: isLabsBudgetExceededError(error),
      forceStatus: isLabsBudgetExceededError(error) ? 'failed' : 'partial',
    });
    throw error;
  }
}

/** Fire-and-forget progressive enrich for generate flows. */
export function runSiloMetricsEnrichInBackground(
  projectId: string,
  workspaceId: string
): void {
  void (async () => {
    try {
      await progressiveEnrichSiloProjectMetrics(projectId, workspaceId);
    } catch (error) {
      if (isEnrichInProgressError(error)) {
        console.info(
          '[silo-metrics-enrich] Skipped background enrich — already in progress:',
          projectId
        );
        return;
      }
      console.error(
        '[silo-metrics-enrich] Background progressive enrich failed:',
        error
      );
      try {
        const prisma = getPrisma();
        const project = await prisma.siloProject.findFirst({
          where: { id: projectId, workspaceId },
          include: { nodes: true },
        });
        if (!project) {
          return;
        }
        const { toNodeDto } = await import('@/lib/silo-builder/persist');
        await syncSiloProjectMetricsStatus(
          projectId,
          project.nodes.map(toNodeDto),
          {
            markFailed: isLabsBudgetExceededError(error),
            forceStatus: isLabsBudgetExceededError(error)
              ? 'failed'
              : 'partial',
          }
        );
      } catch (syncError) {
        console.error(
          '[silo-metrics-enrich] Failed to sync status after enrich error:',
          syncError
        );
      }
    }
  })();
}

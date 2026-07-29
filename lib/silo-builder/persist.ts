import { getPrisma } from '@/lib/prisma';
import {
  progressiveEnrichSiloProjectMetrics,
  syncSiloProjectMetricsStatus,
} from '@/lib/silo-builder/enrich-metrics';
import {
  computeSiloMetricsStatusSummary,
  countNodesNeedingMetrics,
} from '@/lib/silo-builder/metrics';
import {
  resolveTopicalMapProjectType,
  topicalMapToCompetitorSilo,
  topicalMapToKeywordSilo,
} from '@/lib/silo-builder/import-topical-map';
import { recoverStuckSiloNodes } from '@/lib/silo-builder/recover-stuck';
import { parseSemanticGaps } from '@/lib/silo-builder/semantic-gaps';
import { parseRankedKeywords } from '@/lib/silo-builder/ranked-keywords';
import { parseHubGroups } from '@/lib/silo-builder/hub-groups';
import {
  parseKeywordSource,
  parseMetricsConfidence,
} from '@/lib/silo-builder/metrics-confidence';
import type {
  SiloAttackMapResult,
  SiloKeywordMapResult,
  SiloLateralLink,
  SiloNodeDto,
  SiloNodeStatus,
  SiloProjectDto,
  SiloProjectSummary,
  SiloProjectType,
} from '@/lib/silo-builder/types';
import type { SiloNode, SiloProject } from '@prisma/client';

function parseLateralLinks(value: unknown): SiloLateralLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is SiloLateralLink =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SiloLateralLink).spokeTitle === 'string' &&
      typeof (item as SiloLateralLink).suggestedLateralAnchorText === 'string'
  );
}

function parseSemanticEntities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export function toNodeDto(node: SiloNode): SiloNodeDto {
  return {
    id: node.id,
    projectId: node.projectId,
    title: node.title,
    type: node.type as SiloNodeDto['type'],
    targetKeyword: node.targetKeyword,
    originalTargetKeyword: node.originalTargetKeyword,
    keywordSource: parseKeywordSource(node.keywordSource),
    metricsConfidence: parseMetricsConfidence(node.metricsConfidence),
    searchVolume: node.searchVolume,
    difficulty: node.difficulty,
    enrichedAt: node.enrichedAt?.toISOString() ?? null,
    intent: node.intent,
    summary: node.summary,
    funnelStage: node.funnelStage,
    anchorTextToPillar: node.anchorTextToPillar,
    lateralLinks: parseLateralLinks(node.lateralLinks),
    semanticEntities: parseSemanticEntities(node.semanticEntities),
    status: node.status as SiloNodeDto['status'],
    parentId: node.parentId,
    content: node.content,
    slug: node.slug,
    wpPostId: node.wpPostId,
    wpPostStatus:
      node.wpPostStatus === 'publish' || node.wpPostStatus === 'draft'
        ? node.wpPostStatus
        : null,
    articleStudioHistoryId: node.articleStudioHistoryId,
    publishedAt: node.publishedAt?.toISOString() ?? null,
  };
}

export function toProjectDto(
  project: SiloProject,
  nodes: SiloNode[]
): SiloProjectDto {
  const nodeDtos = nodes.map(toNodeDto);
  const preferredStatus =
    project.metricsStatus === 'enriching' ? 'enriching' : null;
  const summary = computeSiloMetricsStatusSummary(
    nodeDtos,
    project.metricsEnrichedAt?.toISOString() ?? null,
    preferredStatus
  );

  return {
    id: project.id,
    title: project.title,
    type: project.type as SiloProjectDto['type'],
    domain: project.domain,
    seedKeyword: project.seedKeyword,
    geography: project.geography,
    niche: project.niche,
    integrationId: project.integrationId,
    semanticGaps: parseSemanticGaps(project.semanticGaps),
    keywordsAnalyzed: project.keywordsAnalyzed,
    rankedKeywords: parseRankedKeywords(project.rankedKeywords),
    hubGroups: parseHubGroups(project.hubGroups),
    importedFromTopicalMapId: project.importedFromTopicalMapId,
    metricsStatus:
      (project.metricsStatus as SiloProjectDto['metricsStatus'] | null) ??
      summary.status,
    metricsEnrichedAt:
      project.metricsEnrichedAt?.toISOString() ?? summary.enrichedAt,
    metricsCompleteCount: project.metricsCompleteCount ?? summary.completeCount,
    metricsTotalCount: project.metricsTotalCount ?? summary.totalCount,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    nodes: nodeDtos,
  };
}

function siloProjectIntegrationCreateData(
  integrationId?: string
): { integration?: { connect: { id: string } } } {
  if (!integrationId) {
    return {};
  }

  return {
    integration: {
      connect: { id: integrationId },
    },
  };
}

type PersistGraphInput = {
  userId: string;
  workspaceId: string;
  integrationId?: string;
  type: SiloProjectType;
  title: string;
  domain?: string;
  seedKeyword?: string;
  geography?: string;
  niche?: string;
  importedFromTopicalMapId?: string;
};

function resolveNodeStatus(status: SiloNodeStatus | undefined): SiloNodeStatus {
  return status ?? 'DRAFT';
}

async function persistNodesFromMap(
  projectId: string,
  map: SiloKeywordMapResult | SiloAttackMapResult
): Promise<SiloNode[]> {
  const prisma = getPrisma();
  const enrichedAt = new Date();

  const pillar = await prisma.siloNode.create({
    data: {
      projectId,
      title: map.pillar.title,
      type: 'PILLAR',
      targetKeyword: map.pillar.targetKeyword,
      originalTargetKeyword: map.pillar.originalTargetKeyword ?? null,
      keywordSource: map.pillar.keywordSource ?? 'gemini',
      metricsConfidence: map.pillar.metricsConfidence ?? 'unavailable',
      searchVolume: map.pillar.searchVolume ?? null,
      difficulty: map.pillar.difficulty ?? null,
      enrichedAt:
        map.pillar.searchVolume != null || map.pillar.difficulty != null
          ? enrichedAt
          : null,
      intent: map.pillar.intent ?? null,
      summary: map.pillar.summary ?? null,
      funnelStage: map.pillar.funnelStage ?? null,
      anchorTextToPillar: map.pillar.anchorTextToPillar ?? null,
      lateralLinks: map.pillar.lateralLinks
        ? JSON.parse(JSON.stringify(map.pillar.lateralLinks))
        : undefined,
      semanticEntities: map.pillar.semanticEntities
        ? JSON.parse(JSON.stringify(map.pillar.semanticEntities))
        : undefined,
      status: resolveNodeStatus(map.pillar.status),
    },
  });

  const spokes = await Promise.all(
    map.spokes.map(spoke =>
      prisma.siloNode.create({
        data: {
          projectId,
          title: spoke.title,
          type: 'SPOKE',
          targetKeyword: spoke.targetKeyword,
          originalTargetKeyword: spoke.originalTargetKeyword ?? null,
          keywordSource: spoke.keywordSource ?? 'gemini',
          metricsConfidence: spoke.metricsConfidence ?? 'unavailable',
          searchVolume: spoke.searchVolume ?? null,
          difficulty: spoke.difficulty ?? null,
          enrichedAt:
            spoke.searchVolume != null || spoke.difficulty != null
              ? enrichedAt
              : null,
          intent: spoke.intent ?? null,
          summary: spoke.summary ?? null,
          funnelStage: spoke.funnelStage ?? null,
          anchorTextToPillar: spoke.anchorTextToPillar ?? null,
          lateralLinks: spoke.lateralLinks
            ? JSON.parse(JSON.stringify(spoke.lateralLinks))
            : undefined,
          semanticEntities: spoke.semanticEntities
            ? JSON.parse(JSON.stringify(spoke.semanticEntities))
            : undefined,
          parentId: pillar.id,
          status: resolveNodeStatus(spoke.status),
        },
      })
    )
  );

  const nodes = [pillar, ...spokes];
  await syncSiloProjectMetricsStatus(projectId, nodes.map(toNodeDto), {
    enrichedAt,
  });

  return nodes;
}

export async function persistKeywordSiloProject(
  input: PersistGraphInput,
  map: SiloKeywordMapResult
): Promise<SiloProjectDto> {
  const prisma = getPrisma();

  const project = await prisma.siloProject.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      ...siloProjectIntegrationCreateData(input.integrationId),
      title: input.title,
      type: input.type,
      seedKeyword: input.seedKeyword ?? null,
      niche: input.niche ?? null,
      geography: input.geography ?? null,
      importedFromTopicalMapId: input.importedFromTopicalMapId ?? null,
    },
  });

  const nodes = await persistNodesFromMap(project.id, map);
  return toProjectDto(project, nodes);
}

export async function persistCompetitorSiloProject(
  input: PersistGraphInput,
  map: SiloAttackMapResult
): Promise<SiloProjectDto> {
  const prisma = getPrisma();

  const project = await prisma.siloProject.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      ...siloProjectIntegrationCreateData(input.integrationId),
      title: input.title,
      type: input.type,
      domain: input.domain ?? null,
      geography: input.geography ?? null,
      niche: input.niche ?? null,
      semanticGaps: map.semanticGaps.length
        ? JSON.parse(JSON.stringify(map.semanticGaps))
        : undefined,
      keywordsAnalyzed: map.keywordsAnalyzed,
      rankedKeywords: map.rankedKeywords.length
        ? JSON.parse(JSON.stringify(map.rankedKeywords))
        : undefined,
      hubGroups: map.hubGroups.length
        ? JSON.parse(JSON.stringify(map.hubGroups))
        : undefined,
      importedFromTopicalMapId: input.importedFromTopicalMapId ?? null,
    },
  });

  const nodes = await persistNodesFromMap(project.id, map);
  return toProjectDto(project, nodes);
}

export async function fetchProjectWithNodes(
  projectId: string,
  workspaceId: string,
  actingUserId?: string
): Promise<SiloProjectDto | null> {
  const prisma = getPrisma();
  const project = await prisma.siloProject.findFirst({
    where: { id: projectId, workspaceId },
    include: { nodes: { orderBy: { createdAt: 'asc' } } },
  });

  if (!project) return null;

  await recoverStuckSiloNodes(
    project.id,
    project.workspaceId,
    actingUserId ?? project.userId
  );

  const refreshed = await prisma.siloProject.findFirst({
    where: { id: projectId, workspaceId },
    include: { nodes: { orderBy: { createdAt: 'asc' } } },
  });

  if (!refreshed) return null;

  // Read-only: never call DataForSEO Labs on project open. Use
  // enrichMissingSiloProjectMetrics / refreshSiloProjectMetrics explicitly.
  return toProjectDto(refreshed, refreshed.nodes);
}

/** Enrich only nodes missing volume/KD/confidence (progressive + batched). */
export async function enrichMissingSiloProjectMetrics(
  projectId: string,
  workspaceId: string
): Promise<{ nodes: SiloNodeDto[]; enrichedCount: number }> {
  const prisma = getPrisma();

  const project = await prisma.siloProject.findFirst({
    where: { id: projectId, workspaceId },
    include: { nodes: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const missingBefore = countNodesNeedingMetrics(project.nodes.map(toNodeDto));
  const updated = await progressiveEnrichSiloProjectMetrics(
    projectId,
    workspaceId
  );

  return {
    nodes: updated,
    enrichedCount: missingBefore,
  };
}

/** Force re-fetch metrics for every node with a keyword (progressive + batched). */
export async function refreshSiloProjectMetrics(
  projectId: string,
  workspaceId: string
): Promise<SiloNodeDto[]> {
  return progressiveEnrichSiloProjectMetrics(projectId, workspaceId, {
    force: true,
  });
}

export async function listSiloProjectsForWorkspace(
  workspaceId: string
): Promise<SiloProjectSummary[]> {
  const prisma = getPrisma();
  const projects = await prisma.siloProject.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { nodes: true },
      },
    },
  });

  return projects.map(project => ({
    id: project.id,
    title: project.title,
    type: project.type as SiloProjectSummary['type'],
    seedKeyword: project.seedKeyword,
    domain: project.domain,
    geography: project.geography,
    nodeCount: project._count.nodes,
    createdAt: project.createdAt.toISOString(),
  }));
}

/** @deprecated Use listSiloProjectsForWorkspace. */
export async function listSiloProjectsForUser(
  userId: string
): Promise<SiloProjectSummary[]> {
  return listSiloProjectsForWorkspace(userId);
}

export async function findSiloProjectByTopicalMapImport(
  topicalMapId: string,
  workspaceId: string
): Promise<SiloProjectDto | null> {
  const prisma = getPrisma();
  const project = await prisma.siloProject.findFirst({
    where: { importedFromTopicalMapId: topicalMapId, workspaceId },
    include: { nodes: { orderBy: { createdAt: 'asc' } } },
  });

  if (!project) {
    return null;
  }

  return fetchProjectWithNodes(project.id, workspaceId);
}

export async function importTopicalMapAsSiloProject(
  userId: string,
  workspaceId: string,
  topicalMapId: string
): Promise<{ project: SiloProjectDto; alreadyImported: boolean }> {
  const existing = await findSiloProjectByTopicalMapImport(topicalMapId, workspaceId);
  if (existing) {
    return { project: existing, alreadyImported: true };
  }

  const prisma = getPrisma();
  const record = await prisma.topicalMap.findFirst({
    where: { id: topicalMapId, workspaceId },
    include: { clusters: true },
  });

  if (!record) {
    throw new Error('Topical map not found');
  }

  const importedFromTopicalMapId = topicalMapId;
  const type = resolveTopicalMapProjectType(record);

  if (type === 'KEYWORD') {
    const { map, title, seedKeyword, geography, niche } = topicalMapToKeywordSilo(record);
    const project = await persistKeywordSiloProject(
      {
        userId,
        workspaceId,
        type: 'KEYWORD',
        title,
        seedKeyword,
        geography,
        niche: niche ?? undefined,
        importedFromTopicalMapId,
      },
      map
    );

    return { project, alreadyImported: false };
  }

  const { map, title, domain, geography, niche } = topicalMapToCompetitorSilo(record);
  const project = await persistCompetitorSiloProject(
    {
      userId,
      workspaceId,
      type: 'COMPETITOR',
      title,
      domain,
      geography,
      niche: niche ?? undefined,
      importedFromTopicalMapId,
    },
    map
  );

  return { project, alreadyImported: false };
}

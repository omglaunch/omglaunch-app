import { getPrisma } from '@/lib/prisma';
import type {
  HubSpokeCluster,
  HubSpokeLateralLink,
  HubSpokeMap,
  HubSpokeMapSummary,
} from '@/lib/hub-spoke-data';
import type { ClusterNode, TopicalMap } from '@prisma/client';

type TopicalMapWithClusters = TopicalMap & {
  clusters: ClusterNode[];
};

function parseLateralLinks(value: unknown): HubSpokeLateralLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is HubSpokeLateralLink =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as HubSpokeLateralLink).spokeTitle === 'string' &&
      typeof (item as HubSpokeLateralLink).suggestedLateralAnchorText === 'string'
  );
}

function parseSemanticEntities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export function clusterNodeToHubSpokeCluster(node: ClusterNode): HubSpokeCluster {
  return {
    id: node.id,
    title: node.articleTitle,
    targetKeyword: node.keyword,
    funnelStage: node.funnelStage,
    searchIntent: node.intent,
    anchorTextToPillar: node.suggestedAnchorText,
    lateralLinks: parseLateralLinks(node.lateralLinks),
    semanticEntities: parseSemanticEntities(node.semanticEntities),
    summary: node.summary,
    searchVolume: node.searchVolume,
    keywordDifficulty: node.keywordDifficulty,
    status: node.status as HubSpokeCluster['status'],
  };
}

export function topicalMapRecordToHubSpokeMap(record: TopicalMapWithClusters): HubSpokeMap {
  return {
    pillar: {
      title: record.pillarTitle,
      targetKeyword: record.pillarKeyword,
      summary: record.pillarSummary,
      primaryCallToAction: record.pillarCta,
    },
    clusters: record.clusters
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(clusterNodeToHubSpokeCluster),
  };
}

export function topicalMapRecordToSummary(record: TopicalMap): HubSpokeMapSummary {
  return {
    id: record.id,
    seedKeyword: record.seedKeyword,
    location: record.location,
    createdAt: record.createdAt.toISOString(),
  };
}

export type TopicalMapSaveMetadata = {
  source?: string;
  competitorDomain?: string;
  coreNiche?: string;
  semanticGaps?: unknown;
  keywordsAnalyzed?: number;
};

export async function saveTopicalMap(
  workspaceId: string,
  seedKeyword: string,
  location: string,
  mapData: HubSpokeMap,
  metadata?: TopicalMapSaveMetadata
): Promise<TopicalMapWithClusters> {
  const prisma = getPrisma();

  return prisma.topicalMap.create({
    data: {
      seedKeyword,
      location,
      workspaceId,
      source: metadata?.source ?? 'HUB_SPOKE',
      competitorDomain: metadata?.competitorDomain ?? null,
      coreNiche: metadata?.coreNiche ?? null,
      semanticGaps: metadata?.semanticGaps
        ? JSON.parse(JSON.stringify(metadata.semanticGaps))
        : undefined,
      keywordsAnalyzed: metadata?.keywordsAnalyzed ?? null,
      pillarTitle: mapData.pillar.title,
      pillarKeyword: mapData.pillar.targetKeyword,
      pillarSummary: mapData.pillar.summary,
      pillarCta: mapData.pillar.primaryCallToAction,
      clusters: {
        create: mapData.clusters.map((cluster, index) => ({
          articleTitle: cluster.title,
          keyword: cluster.targetKeyword,
          intent: cluster.searchIntent,
          funnelStage: cluster.funnelStage,
          suggestedAnchorText: cluster.anchorTextToPillar,
          lateralLinks: JSON.parse(JSON.stringify(cluster.lateralLinks)),
          searchVolume: cluster.searchVolume ?? null,
          keywordDifficulty: cluster.keywordDifficulty ?? null,
          status: cluster.status ?? 'Draft',
          summary: cluster.summary,
          semanticEntities: JSON.parse(JSON.stringify(cluster.semanticEntities)),
          sortOrder: index,
        })),
      },
    },
    include: {
      clusters: true,
    },
  });
}

export async function listTopicalMaps(workspaceId: string): Promise<HubSpokeMapSummary[]> {
  const prisma = getPrisma();

  const records = await prisma.topicalMap.findMany({
    where: {
      workspaceId,
      source: { not: 'COMPETITOR_INTEL' },
      NOT: { seedKeyword: { contains: ' vs ' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return records.map(topicalMapRecordToSummary);
}

export async function getTopicalMapById(
  id: string,
  workspaceId: string
): Promise<(HubSpokeMapSummary & { mapData: HubSpokeMap }) | null> {
  const prisma = getPrisma();

  const record = await prisma.topicalMap.findFirst({
    where: { id, workspaceId },
    include: { clusters: true },
  });

  if (!record) {
    return null;
  }

  return {
    ...topicalMapRecordToSummary(record),
    mapData: topicalMapRecordToHubSpokeMap(record),
  };
}

export async function deleteTopicalMap(id: string, workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();

  const existing = await prisma.topicalMap.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.topicalMap.delete({
    where: { id },
  });

  return true;
}

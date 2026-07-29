import type { HubSpokeCluster, HubSpokeMap } from '@/lib/hub-spoke-data';
import type {
  SiloKeywordMapResult,
  SiloNodeGraphItem,
  SiloNodeStatus,
} from '@/lib/silo-builder/types';

function mapClusterStatusToSilo(status: HubSpokeCluster['status']): SiloNodeStatus | undefined {
  switch (status?.toLowerCase()) {
    case 'generating':
      return 'GENERATING';
    case 'published':
      return 'COMPLETED';
    case 'draft':
      return 'DRAFT';
    default:
      return undefined;
  }
}

export function hubSpokeClusterToSpoke(cluster: HubSpokeCluster): SiloNodeGraphItem {
  return {
    title: cluster.title,
    type: 'SPOKE',
    targetKeyword: cluster.targetKeyword,
    intent: cluster.searchIntent,
    funnelStage: cluster.funnelStage,
    summary: cluster.summary,
    anchorTextToPillar: cluster.anchorTextToPillar,
    lateralLinks: cluster.lateralLinks,
    semanticEntities: cluster.semanticEntities,
    searchVolume: cluster.searchVolume ?? null,
    difficulty: cluster.keywordDifficulty ?? null,
    parentIndex: null,
    status: mapClusterStatusToSilo(cluster.status),
  };
}

export function hubSpokeMapToKeywordSilo(map: HubSpokeMap): SiloKeywordMapResult {
  return {
    pillar: {
      title: map.pillar.title,
      type: 'PILLAR',
      targetKeyword: map.pillar.targetKeyword,
      intent: 'Informational',
      summary: map.pillar.summary,
      searchVolume: null,
      difficulty: null,
    },
    spokes: map.clusters.map(hubSpokeClusterToSpoke),
  };
}

import type { ClusterNode, TopicalMap } from '@prisma/client';
import { topicalMapRecordToHubSpokeMap } from '@/lib/topical-map/persistence';
import { hubSpokeMapToKeywordSilo } from '@/lib/silo-builder/hub-spoke-convert';
import { parseSemanticGaps } from '@/lib/silo-builder/semantic-gaps';
import type {
  SiloAttackMapResult,
  SiloKeywordMapResult,
  SiloNodeStatus,
  SiloProjectType,
} from '@/lib/silo-builder/types';

const LEGACY_SEED_PATTERN = ' vs ';

export type TopicalMapWithClusters = TopicalMap & {
  clusters: ClusterNode[];
};

export function resolveTopicalMapProjectType(record: TopicalMap): SiloProjectType {
  if (record.source === 'COMPETITOR_INTEL') {
    return 'COMPETITOR';
  }

  if (record.seedKeyword.includes(LEGACY_SEED_PATTERN)) {
    return 'COMPETITOR';
  }

  return 'KEYWORD';
}

export function mapClusterStatusToSilo(status: string | undefined): SiloNodeStatus {
  switch (status?.toLowerCase()) {
    case 'generating':
      return 'GENERATING';
    case 'published':
      return 'COMPLETED';
    default:
      return 'DRAFT';
  }
}

function parseLegacySeedKeyword(seedKeyword: string): {
  coreNiche: string | null;
  competitorDomain: string | null;
} {
  const index = seedKeyword.lastIndexOf(LEGACY_SEED_PATTERN);
  if (index <= 0) {
    return { coreNiche: null, competitorDomain: null };
  }

  return {
    coreNiche: seedKeyword.slice(0, index).trim() || null,
    competitorDomain: seedKeyword.slice(index + LEGACY_SEED_PATTERN.length).trim() || null,
  };
}

function sortedClusters(record: TopicalMapWithClusters): ClusterNode[] {
  return [...record.clusters].sort((left, right) => left.sortOrder - right.sortOrder);
}

function applyClusterStatuses(
  map: SiloKeywordMapResult,
  clusters: ClusterNode[]
): SiloKeywordMapResult {
  return {
    pillar: map.pillar,
    spokes: map.spokes.map((spoke, index) => ({
      ...spoke,
      status: clusters[index]
        ? mapClusterStatusToSilo(clusters[index].status)
        : 'DRAFT',
    })),
  };
}

export function topicalMapToKeywordSilo(record: TopicalMapWithClusters): {
  map: SiloKeywordMapResult;
  title: string;
  seedKeyword: string;
  geography: string;
  niche: string | null;
} {
  const hubMap = topicalMapRecordToHubSpokeMap(record);
  const map = applyClusterStatuses(
    hubSpokeMapToKeywordSilo(hubMap),
    sortedClusters(record)
  );

  return {
    map,
    title: `Silo: ${record.seedKeyword}`,
    seedKeyword: record.seedKeyword,
    geography: record.location,
    niche: record.coreNiche ?? null,
  };
}

export function topicalMapToCompetitorSilo(record: TopicalMapWithClusters): {
  map: SiloAttackMapResult;
  title: string;
  domain: string;
  geography: string;
  niche: string | null;
} {
  const hubMap = topicalMapRecordToHubSpokeMap(record);
  const keywordSilo = applyClusterStatuses(
    hubSpokeMapToKeywordSilo(hubMap),
    sortedClusters(record)
  );
  const legacy = parseLegacySeedKeyword(record.seedKeyword);
  const domain = record.competitorDomain ?? legacy.competitorDomain ?? 'competitor';
  const niche = record.coreNiche ?? legacy.coreNiche ?? null;

  return {
    map: {
      semanticGaps: parseSemanticGaps(record.semanticGaps),
      keywordsAnalyzed: record.keywordsAnalyzed ?? 0,
      rankedKeywords: [],
      hubGroups: [],
      pillar: keywordSilo.pillar,
      spokes: keywordSilo.spokes,
    },
    title: `Attack Map: ${domain}`,
    domain,
    geography: record.location,
    niche,
  };
}

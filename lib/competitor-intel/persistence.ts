import { getPrisma } from '@/lib/prisma';
import {
  deleteTopicalMap,
  topicalMapRecordToHubSpokeMap,
} from '@/lib/topical-map/persistence';
import type { HubSpokeMap } from '@/lib/hub-spoke-data';
import type { SemanticGap } from '@/lib/competitor-intel/types';

export type CompetitorIntelSummary = {
  id: string;
  competitorDomain: string | null;
  coreNiche: string | null;
  targetCountry: string;
  keywordsAnalyzed: number | null;
  createdAt: string;
};

export type CompetitorIntelRun = CompetitorIntelSummary & {
  map: HubSpokeMap;
  semanticGaps: SemanticGap[];
};

const LEGACY_SEED_PATTERN = ' vs ';

function parseSemanticGaps(value: unknown): SemanticGap[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is SemanticGap =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SemanticGap).topic === 'string' &&
      typeof (item as SemanticGap).rationale === 'string' &&
      ['high', 'medium', 'low'].includes((item as SemanticGap).priority)
  );
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

function recordToSummary(record: {
  id: string;
  location: string;
  createdAt: Date;
  competitorDomain: string | null;
  coreNiche: string | null;
  keywordsAnalyzed: number | null;
  seedKeyword: string;
  source: string;
}): CompetitorIntelSummary {
  const legacy =
    record.source !== 'COMPETITOR_INTEL'
      ? parseLegacySeedKeyword(record.seedKeyword)
      : { coreNiche: null, competitorDomain: null };

  return {
    id: record.id,
    competitorDomain: record.competitorDomain ?? legacy.competitorDomain,
    coreNiche: record.coreNiche ?? legacy.coreNiche,
    targetCountry: record.location,
    keywordsAnalyzed: record.keywordsAnalyzed,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listCompetitorIntelRuns(
  workspaceId: string
): Promise<CompetitorIntelSummary[]> {
  const prisma = getPrisma();

  const records = await prisma.topicalMap.findMany({
    where: {
      workspaceId,
      OR: [
        { source: 'COMPETITOR_INTEL' },
        { seedKeyword: { contains: LEGACY_SEED_PATTERN } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      location: true,
      createdAt: true,
      competitorDomain: true,
      coreNiche: true,
      keywordsAnalyzed: true,
      seedKeyword: true,
      source: true,
    },
  });

  return records.map(recordToSummary);
}

export async function getCompetitorIntelRun(
  id: string,
  workspaceId: string
): Promise<CompetitorIntelRun | null> {
  const prisma = getPrisma();

  const record = await prisma.topicalMap.findFirst({
    where: {
      id,
      workspaceId,
      OR: [
        { source: 'COMPETITOR_INTEL' },
        { seedKeyword: { contains: LEGACY_SEED_PATTERN } },
      ],
    },
    include: { clusters: true },
  });

  if (!record) {
    return null;
  }

  const summary = recordToSummary(record);

  return {
    ...summary,
    map: topicalMapRecordToHubSpokeMap(record),
    semanticGaps: parseSemanticGaps(record.semanticGaps),
  };
}

export async function deleteCompetitorIntelRun(
  id: string,
  workspaceId: string
): Promise<boolean> {
  const existing = await getCompetitorIntelRun(id, workspaceId);
  if (!existing) {
    return false;
  }

  return deleteTopicalMap(id, workspaceId);
}

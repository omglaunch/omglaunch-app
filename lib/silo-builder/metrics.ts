import type { SiloNodeDto } from '@/lib/silo-builder/types';
import { isDecisionGradeMetrics } from '@/lib/silo-builder/metrics-confidence';

export type SiloProjectMetrics = {
  totalTrafficPool: number | null;
  competitiveIndex: number | null;
  architecturalConnections: number;
  verifiedSpokeCount: number;
  totalSpokeCount: number;
};

export function computeSiloProjectMetrics(nodes: SiloNodeDto[]): SiloProjectMetrics {
  const spokes = nodes.filter(node => node.type === 'SPOKE');

  const volumes = spokes
    .map(node => node.searchVolume)
    .filter((value): value is number => typeof value === 'number');

  const totalTrafficPool =
    volumes.length > 0 ? volumes.reduce((sum, value) => sum + value, 0) : null;

  const verifiedSpokes = spokes.filter(
    node =>
      isDecisionGradeMetrics(node.metricsConfidence) &&
      typeof node.difficulty === 'number'
  );

  let competitiveIndex: number | null = null;

  if (verifiedSpokes.length > 0) {
    const totalWeight = verifiedSpokes.reduce(
      (sum, node) => sum + (node.searchVolume ?? 0),
      0
    );

    if (totalWeight > 0) {
      const weightedSum = verifiedSpokes.reduce(
        (sum, node) => sum + node.difficulty! * (node.searchVolume ?? 0),
        0
      );
      competitiveIndex = Math.round(weightedSum / totalWeight);
    } else {
      const average =
        verifiedSpokes.reduce((sum, node) => sum + node.difficulty!, 0) /
        verifiedSpokes.length;
      competitiveIndex = Math.round(average);
    }
  }

  const pillarLinks = spokes.length;
  const lateralLinks = spokes.reduce(
    (sum, spoke) => sum + spoke.lateralLinks.length,
    0
  );

  return {
    totalTrafficPool,
    competitiveIndex,
    architecturalConnections: pillarLinks + lateralLinks,
    verifiedSpokeCount: verifiedSpokes.length,
    totalSpokeCount: spokes.length,
  };
}

/** Node is incomplete for reporting — missing volume, KD, or confidence. */
export function nodeNeedsMetrics(node: SiloNodeDto): boolean {
  return Boolean(
    node.targetKeyword?.trim() &&
      (node.searchVolume === null ||
        node.difficulty === null ||
        !node.metricsConfidence)
  );
}

export function countNodesNeedingMetrics(nodes: SiloNodeDto[]): number {
  return nodes.filter(nodeNeedsMetrics).length;
}

export type SiloMetricsStatus =
  | 'complete'
  | 'partial'
  | 'failed'
  | 'never'
  | 'enriching';

export type SiloMetricsStatusSummary = {
  status: SiloMetricsStatus;
  completeCount: number;
  totalCount: number;
  enrichedAt: string | null;
};

export function computeSiloMetricsStatusSummary(
  nodes: SiloNodeDto[],
  projectEnrichedAt?: string | null,
  preferredStatus?: SiloMetricsStatus | null
): SiloMetricsStatusSummary {
  const keywordNodes = nodes.filter(node => Boolean(node.targetKeyword?.trim()));
  const totalCount = keywordNodes.length;
  const completeCount = keywordNodes.filter(node => !nodeNeedsMetrics(node)).length;

  const nodeEnrichedAts = keywordNodes
    .map(node => node.enrichedAt)
    .filter((value): value is string => Boolean(value));

  const enrichedAt =
    projectEnrichedAt ??
    (nodeEnrichedAts.length > 0
      ? nodeEnrichedAts.reduce((latest, current) =>
          current > latest ? current : latest
        )
      : null);

  let status: SiloMetricsStatus;
  if (preferredStatus === 'enriching' && completeCount < totalCount) {
    status = 'enriching';
  } else if (totalCount === 0 || completeCount === 0) {
    status = enrichedAt ? 'failed' : 'never';
  } else if (completeCount === totalCount) {
    status = 'complete';
  } else {
    status = 'partial';
  }

  return {
    status,
    completeCount,
    totalCount,
    enrichedAt,
  };
}

import type { HubSpokeMap } from '@/lib/hub-spoke-data';

export type SiloSummaryMetrics = {
  totalTrafficPool: number | null;
  competitiveIndex: number | null;
  architecturalConnections: number;
};

export function computeSiloSummaryMetrics(map: HubSpokeMap): SiloSummaryMetrics {
  const volumes = map.clusters
    .map(cluster => cluster.searchVolume)
    .filter((value): value is number => typeof value === 'number');

  const totalTrafficPool =
    volumes.length > 0 ? volumes.reduce((sum, value) => sum + value, 0) : null;

  const clustersWithKd = map.clusters.filter(
    cluster => typeof cluster.keywordDifficulty === 'number'
  );

  let competitiveIndex: number | null = null;

  if (clustersWithKd.length > 0) {
    const totalWeight = clustersWithKd.reduce(
      (sum, cluster) => sum + (cluster.searchVolume ?? 0),
      0
    );

    if (totalWeight > 0) {
      const weightedSum = clustersWithKd.reduce(
        (sum, cluster) =>
          sum + cluster.keywordDifficulty! * (cluster.searchVolume ?? 0),
        0
      );
      competitiveIndex = Math.round(weightedSum / totalWeight);
    } else {
      const average =
        clustersWithKd.reduce((sum, cluster) => sum + cluster.keywordDifficulty!, 0) /
        clustersWithKd.length;
      competitiveIndex = Math.round(average);
    }
  }

  const pillarLinks = map.clusters.length;
  const lateralLinks = map.clusters.reduce(
    (sum, cluster) => sum + cluster.lateralLinks.length,
    0
  );

  return {
    totalTrafficPool,
    competitiveIndex,
    architecturalConnections: pillarLinks + lateralLinks,
  };
}

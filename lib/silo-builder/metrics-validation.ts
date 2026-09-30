import type { ClusterKeywordMetrics } from '@/lib/topical-map/dataforseo-metrics';

const HIGH_VOLUME_KD_ZERO_THRESHOLD = 500;

export function isSuspiciousHighVolumeZeroKd(
  metrics: ClusterKeywordMetrics
): boolean {
  return (
    typeof metrics.searchVolume === 'number' &&
    metrics.searchVolume > HIGH_VOLUME_KD_ZERO_THRESHOLD &&
    metrics.keywordDifficulty === 0
  );
}

export function sanitizeKeywordMetrics(
  metrics: ClusterKeywordMetrics,
  exactMatch: boolean
): ClusterKeywordMetrics {
  if (!exactMatch) {
    return { searchVolume: null, keywordDifficulty: null, exactMatch: false };
  }

  if (isSuspiciousHighVolumeZeroKd(metrics)) {
    return {
      searchVolume: metrics.searchVolume,
      keywordDifficulty: null,
      exactMatch: metrics.exactMatch,
    };
  }

  return metrics;
}

export function resolveMetricsConfidence(input: {
  keywordChanged: boolean;
  keywordSource: 'gemini' | 'competitor' | 'resolved' | 'manual';
  exactMatch: boolean;
  searchVolume: number | null;
  difficulty: number | null;
}): 'exact' | 'resolved' | 'unavailable' {
  if (!input.exactMatch || (input.searchVolume === null && input.difficulty === null)) {
    return 'unavailable';
  }

  if (input.difficulty === null) {
    return input.keywordChanged || input.keywordSource !== 'gemini'
      ? 'resolved'
      : 'unavailable';
  }

  if (input.keywordChanged || input.keywordSource !== 'gemini') {
    return 'resolved';
  }

  return 'exact';
}

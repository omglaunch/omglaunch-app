export type SiloKeywordSource = 'gemini' | 'competitor' | 'resolved' | 'manual';

export type SiloMetricsConfidence = 'exact' | 'resolved' | 'unavailable';

export type SiloNodeMetricsMeta = {
  targetKeyword: string;
  originalTargetKeyword: string | null;
  keywordSource: SiloKeywordSource;
  metricsConfidence: SiloMetricsConfidence;
  searchVolume: number | null;
  difficulty: number | null;
};

export function formatMetricsConfidenceLabel(
  confidence: SiloMetricsConfidence | null | undefined
): string {
  switch (confidence) {
    case 'exact':
      return 'Verified';
    case 'resolved':
      return 'Resolved';
    case 'unavailable':
      return 'Unverified';
    default:
      return 'Legacy';
  }
}

export function isDecisionGradeMetrics(
  confidence: SiloMetricsConfidence | null | undefined
): boolean {
  return confidence === 'exact' || confidence === 'resolved';
}

export function parseKeywordSource(value: unknown): SiloKeywordSource | null {
  if (
    value === 'gemini' ||
    value === 'competitor' ||
    value === 'resolved' ||
    value === 'manual'
  ) {
    return value;
  }

  return null;
}

export function parseMetricsConfidence(
  value: unknown
): SiloMetricsConfidence | null {
  if (value === 'exact' || value === 'resolved' || value === 'unavailable') {
    return value;
  }

  return null;
}

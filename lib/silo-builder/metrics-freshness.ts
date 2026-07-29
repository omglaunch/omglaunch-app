const METRICS_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type MetricsFreshness = {
  enrichedAt: string | null;
  isStale: boolean;
  /** e.g. "as of Jul 11" or "stale · as of Jul 11" */
  label: string | null;
  /** Short date for compact badges */
  shortDate: string | null;
};

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function getMetricsFreshness(
  enrichedAt: string | null | undefined
): MetricsFreshness {
  if (!enrichedAt) {
    return {
      enrichedAt: null,
      isStale: false,
      label: null,
      shortDate: null,
    };
  }

  const date = new Date(enrichedAt);
  if (Number.isNaN(date.getTime())) {
    return {
      enrichedAt: null,
      isStale: false,
      label: null,
      shortDate: null,
    };
  }

  const ageMs = Date.now() - date.getTime();
  const isStale = ageMs > METRICS_STALE_AFTER_MS;
  const shortDate = formatShortDate(enrichedAt);

  return {
    enrichedAt,
    isStale,
    shortDate,
    label: isStale ? `stale · as of ${shortDate}` : `as of ${shortDate}`,
  };
}

/** Prefer node.enrichedAt, fall back to project-level stamp. */
export function resolveNodeMetricsEnrichedAt(
  nodeEnrichedAt: string | null | undefined,
  projectEnrichedAt?: string | null
): string | null {
  return nodeEnrichedAt ?? projectEnrichedAt ?? null;
}

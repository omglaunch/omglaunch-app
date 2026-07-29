import { fetchClusterKeywordMetricsBatch } from '@/lib/topical-map/dataforseo-metrics';
import type { RankedKeywordRow } from '@/lib/silo-builder/dataforseo-ranked';
import type { SiloNodeMetricsMeta } from '@/lib/silo-builder/metrics-confidence';
import {
  resolveMetricsConfidence,
  sanitizeKeywordMetrics,
} from '@/lib/silo-builder/metrics-validation';
import {
  resolveCanonicalKeyword,
  type CanonicalKeywordResolution,
} from '@/lib/silo-builder/resolve-canonical-keyword';

export async function enrichKeywordWithMetrics(input: {
  rawKeyword: string;
  location: string;
  workspaceId: string;
  competitorKeywords?: RankedKeywordRow[];
  keywordSourceOverride?: SiloNodeMetricsMeta['keywordSource'];
  forceRefresh?: boolean;
}): Promise<SiloNodeMetricsMeta> {
  const resolution =
    input.keywordSourceOverride === 'manual'
      ? {
          keyword: input.rawKeyword.trim(),
          originalKeyword: input.rawKeyword.trim(),
          keywordSource: 'manual' as const,
          keywordChanged: false,
        }
      : resolveCanonicalKeyword(
          input.rawKeyword,
          input.competitorKeywords ?? []
        );

  const metricsMap = await fetchClusterKeywordMetricsBatch(
    [resolution.keyword],
    input.location,
    input.workspaceId,
    { forceRefresh: input.forceRefresh }
  );

  const rawMetrics = metricsMap.get(resolution.keyword) ?? {
    searchVolume: null,
    keywordDifficulty: null,
    exactMatch: false,
  };

  const sanitized = sanitizeKeywordMetrics(rawMetrics, rawMetrics.exactMatch);
  const metricsConfidence = resolveMetricsConfidence({
    keywordChanged: resolution.keywordChanged,
    keywordSource: input.keywordSourceOverride ?? resolution.keywordSource,
    exactMatch: rawMetrics.exactMatch,
    searchVolume: sanitized.searchVolume,
    difficulty: sanitized.keywordDifficulty,
  });

  return {
    targetKeyword: resolution.keyword,
    originalTargetKeyword: resolution.keywordChanged
      ? resolution.originalKeyword
      : null,
    keywordSource: input.keywordSourceOverride ?? resolution.keywordSource,
    metricsConfidence,
    searchVolume: sanitized.searchVolume,
    difficulty: sanitized.keywordDifficulty,
  };
}

export async function enrichKeywordsWithMetrics(input: {
  rawKeywords: string[];
  location: string;
  workspaceId: string;
  competitorKeywords?: RankedKeywordRow[];
  forceRefresh?: boolean;
}): Promise<Map<string, SiloNodeMetricsMeta>> {
  const resolutions = new Map<string, CanonicalKeywordResolution>();

  for (const rawKeyword of input.rawKeywords) {
    if (!rawKeyword.trim()) {
      continue;
    }

    resolutions.set(
      rawKeyword,
      resolveCanonicalKeyword(rawKeyword, input.competitorKeywords ?? [])
    );
  }

  const canonicalKeywords = Array.from(
    new Set(
      Array.from(resolutions.values()).map(resolution => resolution.keyword)
    )
  );

  const metricsMap = await fetchClusterKeywordMetricsBatch(
    canonicalKeywords,
    input.location,
    input.workspaceId,
    { forceRefresh: input.forceRefresh }
  );

  const enriched = new Map<string, SiloNodeMetricsMeta>();

  for (const [rawKeyword, resolution] of Array.from(resolutions.entries())) {
    const rawMetrics = metricsMap.get(resolution.keyword) ?? {
      searchVolume: null,
      keywordDifficulty: null,
      exactMatch: false,
    };
    const sanitized = sanitizeKeywordMetrics(rawMetrics, rawMetrics.exactMatch);
    const metricsConfidence = resolveMetricsConfidence({
      keywordChanged: resolution.keywordChanged,
      keywordSource: resolution.keywordSource,
      exactMatch: rawMetrics.exactMatch,
      searchVolume: sanitized.searchVolume,
      difficulty: sanitized.keywordDifficulty,
    });

    enriched.set(rawKeyword, {
      targetKeyword: resolution.keyword,
      originalTargetKeyword: resolution.keywordChanged
        ? resolution.originalKeyword
        : null,
      keywordSource: resolution.keywordSource,
      metricsConfidence,
      searchVolume: sanitized.searchVolume,
      difficulty: sanitized.keywordDifficulty,
    });
  }

  return enriched;
}

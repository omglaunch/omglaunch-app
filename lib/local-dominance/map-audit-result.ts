import type {
  CompetitorShift,
  GeogridRunResult,
  GridCell,
  GridSize,
  GbpPerformanceMetrics,
  PerplexityRecommendation,
  SpamRadarEntry,
  TrendDataPoint,
} from './types';

type LocalAuditRecord = {
  id: string;
  shareToken: string;
  keyword: string;
  centralLat: number;
  centralLng: number;
  radiusKm: number;
  gridSize: number;
  platform: string;
  businessName: string | null;
  businessCid: string | null;
  solvScore: number | null;
  saivScore: number | null;
  gridResults: unknown;
  aiVisibility?: unknown;
  perplexityRecs?: unknown;
  gbpMetrics?: unknown;
  spamRadar?: unknown;
  competitorShifts?: unknown;
  trendData?: unknown;
};

function asGridSize(value: number): GridSize {
  if (value === 3 || value === 5 || value === 7) {
    return value;
  }

  return 5;
}

export function mapLocalAuditToGeogridResult(audit: LocalAuditRecord): GeogridRunResult {
  return {
    auditId: audit.id,
    shareToken: audit.shareToken,
    solvScore: audit.solvScore ?? 0,
    saivScore: audit.saivScore ?? 0,
    gridResults: (audit.gridResults as GridCell[]) ?? [],
    resolvedCenter: {
      lat: audit.centralLat,
      lng: audit.centralLng,
      source: 'manual',
      locationLabel: `${audit.centralLat}, ${audit.centralLng}`,
    },
    aiVisibility: (audit.aiVisibility as Record<string, unknown>) ?? {},
    perplexityRecs: (audit.perplexityRecs as PerplexityRecommendation[]) ?? [],
    gbpMetrics: (audit.gbpMetrics as GbpPerformanceMetrics | null) ?? null,
    spamRadar: (audit.spamRadar as SpamRadarEntry[]) ?? [],
    competitorShifts: (audit.competitorShifts as CompetitorShift[]) ?? [],
    trendData: (audit.trendData as TrendDataPoint[]) ?? [],
  };
}

export type SavedGeogridAudit = GeogridRunResult & {
  keyword: string;
  centralLat: number;
  centralLng: number;
  radiusKm: number;
  gridSize: GridSize;
  platform: 'google' | 'bing';
  businessName: string | null;
  businessCid: string | null;
};

export function mapLocalAuditToSavedAudit(audit: LocalAuditRecord): SavedGeogridAudit {
  const platform = audit.platform === 'bing' ? 'bing' : 'google';

  return {
    ...mapLocalAuditToGeogridResult(audit),
    keyword: audit.keyword,
    centralLat: audit.centralLat,
    centralLng: audit.centralLng,
    radiusKm: audit.radiusKm,
    gridSize: asGridSize(audit.gridSize),
    platform,
    businessName: audit.businessName,
    businessCid: audit.businessCid,
  };
}

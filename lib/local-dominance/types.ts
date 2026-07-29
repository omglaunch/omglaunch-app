export type GridSize = 3 | 5 | 7;
export type GeogridPlatform = 'google' | 'bing';

export type GridCell = {
  row: number;
  col: number;
  lat: number;
  lng: number;
  rank: number | null;
  businessName: string | null;
  cid: string | null;
  mapPack: MapPackEntry[];
  aiVisible: boolean | null;
};

export type MapPackEntry = {
  rank: number;
  title: string;
  cid: string | null;
  placeId?: string | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
};

export type GeogridRunInput = {
  projectId: string;
  keyword: string;
  centralLat?: number;
  centralLng?: number;
  radiusKm: number;
  gridSize: GridSize;
  platform: GeogridPlatform;
  businessName?: string;
  businessCid?: string;
  scheduleRun?: boolean;
  scheduleFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dateRangeStart?: string;
  dateRangeEnd?: string;
};

export type ResolvedGeogridCenter = {
  lat: number;
  lng: number;
  source: 'manual' | 'business_name' | 'keyword' | 'default_location';
  locationLabel: string;
};

export type GeogridRunResult = {
  auditId: string;
  shareToken: string;
  solvScore: number;
  saivScore: number;
  gridResults: GridCell[];
  resolvedCenter?: ResolvedGeogridCenter;
  aiVisibility: Record<string, unknown>;
  perplexityRecs: PerplexityRecommendation[];
  gbpMetrics: GbpPerformanceMetrics | null;
  spamRadar: SpamRadarEntry[];
  competitorShifts: CompetitorShift[];
  trendData: TrendDataPoint[];
};

export type PerplexityRecommendation = {
  rank: number;
  title: string;
  summary: string;
  source: string;
};

export type GbpPerformanceMetrics = {
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  dailySeries: Array<{
    date: string;
    calls: number;
    websiteClicks: number;
    directionRequests: number;
  }>;
};

export type SpamRadarEntry = {
  businessName: string;
  cid: string | null;
  reason: string;
  severity: 'low' | 'medium' | 'high';
};

export type CompetitorShift = {
  businessName: string;
  cid: string | null;
  previousRank: number | null;
  currentRank: number | null;
  delta: number;
  cellsAffected: number;
};

export type TrendDataPoint = {
  date: string;
  solv: number;
  calls: number;
  websiteClicks: number;
};

export type ServiceAreaQueueInput = {
  coreService: string;
  targetCities: string[];
  clientCid?: string;
  centralLat?: number;
  centralLng?: number;
};

export type CitationAuditInput = {
  brandName: string;
  address: string;
  phone: string;
  website?: string;
};

export type CitationAuditResult = {
  citationsFound: number;
  consistent: number;
  inconsistent: number;
  missing: number;
  entries: Array<{
    source: string;
    url: string;
    napMatch: 'consistent' | 'inconsistent' | 'partial';
    details: string;
  }>;
};

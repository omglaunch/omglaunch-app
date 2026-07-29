export const DIAGNOSES = [
  'Rank Drop',
  'CTR Decay',
  'Cannibalization Risk',
  'Intent Pivot',
  'AI Overview Interference',
] as const;

export type Diagnosis = (typeof DIAGNOSES)[number];

export const OPTIMIZATION_GAPS = [
  'Missing Entities',
  'Low Word Count',
  'Thin H2 Coverage',
  'Weak Internal Links',
  'Orphan Page',
  'Title CTR Gap',
  'Schema Incomplete',
] as const;

export type OptimizationGap = (typeof OPTIMIZATION_GAPS)[number];

export type Segment = 'content-decay' | 'striking-distance';
export type DateMode = 'mom' | 'yoy';
export type ViewMode = 'list' | 'group';

export type RowStatus =
  | 'open'
  | 'monitoring'
  | 're-evaluation'
  | 'ignored'
  | 'seasonal';

export type DecaySortField =
  | 'page'
  | 'clicks'
  | 'delta'
  | 'diagnosis'
  | 'revenue';

export type StrikingSortField =
  | 'page'
  | 'rank'
  | 'volume'
  | 'trafficGain'
  | 'gap';

export type SortField = DecaySortField | StrikingSortField;
export type SortDirection = 'asc' | 'desc';

export type TrendPoint = {
  /** Day index 0..89 */
  day: number;
  clicks: number;
  benchmark: number;
};

export type KeywordVariant = {
  keyword: string;
  clicks: number;
  impressions: number;
};

export type Assignee = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type RevenueRescueRow = {
  id: string;
  canonicalUrl: string;
  path: string;
  silo: string;
  targetKeyword: string;
  variants: KeywordVariant[];
  segment: Segment;
  diagnosis: Diagnosis;
  competitorContext: string;
  peakClicks: number;
  currentClicks: number;
  trafficDelta: number;
  trafficDeltaPct: number;
  engagementDeltaPct: number;
  estimatedRevenueAtRisk: number;
  /** Striking-distance fields */
  currentRank: number;
  searchVolume: number;
  estTrafficGain: number;
  optimizationGaps: OptimizationGap[];
  trend: TrendPoint[];
  /** Index in trend where core update hit (null = none) */
  coreUpdateDay: number | null;
  /** Index where optimization fix was applied */
  fixDay: number | null;
  coreUpdateLabel: string | null;
  status: RowStatus;
  /** Days into 28-day monitoring window when status === monitoring */
  monitoringDay: number | null;
  processedAt: string | null;
  assignee: Assignee | null;
  /** Async cell still loading */
  diagnosisLoading?: boolean;
};

export type RevenueRescueSummary = {
  totalClicksLost: number;
  decayingUrls: number;
  strikingDistance: number;
  estimatedRevenueAtRisk: number;
  estimatedRevenueOpportunity: number;
};

export type RevenueRescuePrefill = {
  source: 'revenue-rescue';
  url: string;
  targetKeyword: string;
  title: string;
  diagnosis: Diagnosis;
  metricDelta: number;
  metricDeltaPct: number;
  canonicalUrl: string;
  engagementDeltaPct: number;
};

export const AVG_CONVERSION_VALUE_KEY = 'revenue-rescue-avg-conversion-value';
export const REVENUE_RESCUE_PREFILL_KEY = 'revenue-rescue-prefill';
export const DEFAULT_AVG_CONVERSION_VALUE = 48;

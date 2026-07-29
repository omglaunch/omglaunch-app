/** Prompt Onboarding Engine — types */

export const STAGING_HARD_CEILING = 100;

export const ONBOARDING_SOURCES = ['crawler', 'gsc', 'csv'] as const;
export type OnboardingSource = (typeof ONBOARDING_SOURCES)[number];

export const ONBOARDING_TABS = [
  'auto-discover',
  'gsc-import',
  'bulk-upload',
] as const;
export type OnboardingTab = (typeof ONBOARDING_TABS)[number];

export type GeoTargetOption = {
  /** Standardized Search API / DataForSEO location id */
  locationId: string;
  label: string;
  countryCode?: string;
  /** Pinned Global / National option */
  isGlobal?: boolean;
};

export const GLOBAL_GEO: GeoTargetOption = {
  locationId: 'global',
  label: 'Global / National (US fallback)',
  countryCode: 'US',
  isGlobal: true,
};

export const FALLBACK_WORKSPACE_GEO: GeoTargetOption = {
  locationId: '2840',
  label: 'US - National',
  countryCode: 'US',
};

export type StagingRowError =
  | 'empty_prompt'
  | 'geo_unresolved'
  | 'duplicate'
  | 'validation';

export type StagingPromptRow = {
  /** Immutable crypto UUID — minted at ingestion, never in render */
  id: string;
  prompt: string;
  /** Normalized for cross-source dedupe */
  promptNormalized: string;
  source: OnboardingSource;
  cluster: string;
  geo: GeoTargetOption | null;
  /** Yellow error state until geo Location ID resolves */
  geoPending?: boolean;
  errors: StagingRowError[];
  createdAt: string;
};

export type WorkspaceTrackingSettings = {
  remainingAccountLimit: number;
  activeDefaultEngines: number;
  /** Weekly=1, every_48h≈3.5, daily≈4.3 (monthly sync multiplier) */
  syncFrequencyMultiplier: number;
  defaultGeo: GeoTargetOption;
  creditsPerEngineSync: number;
};

export type BulkEditPatch = {
  cluster?: string;
  geo?: GeoTargetOption | null;
};

export type OnboardingCommitPayload = {
  prompts: Array<{
    id: string;
    prompt: string;
    cluster: string;
    geoLocationId: string;
    geoLabel: string;
    source: OnboardingSource;
  }>;
};

export type OnboardingCommitResult = {
  created: number;
  skippedDuplicates: number;
  clusterIds: string[];
  promptIds: string[];
};

export type SseTerminalLine = {
  id: string;
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'ping';
  message: string;
};

export const SOURCE_LABELS: Record<OnboardingSource, string> = {
  crawler: 'Crawler',
  gsc: 'GSC',
  csv: 'CSV',
};

export const ENGINES = [
  'all',
  'google_aio',
  'perplexity',
  'chatgpt',
  'claude',
] as const;

export type EngineFilter = (typeof ENGINES)[number];
export type TrackedEngine = Exclude<EngineFilter, 'all'>;

export const RAG_ONLY_ENGINES: TrackedEngine[] = ['chatgpt', 'claude'];

export type DeviceEnvironment = 'desktop' | 'mobile';
export type ChatGptMode = 'live_web' | 'base_knowledge';

export const CITATION_STATUSES = [
  'all',
  'omitted_everywhere',
  'partially_omitted',
  'sync_failed',
  'negative_context',
] as const;

export type CitationStatusFilter = (typeof CITATION_STATUSES)[number];

export type SyncDotStatus =
  | 'cited'
  | 'omitted'
  | 'failed'
  | 'pending'
  | 'na';

export type GoogleAioCitation =
  | { kind: 'cited'; rank: 1 | 2 | 3; latency: 'instant' | 'delayed'; loading?: boolean }
  | { kind: 'omitted'; loading?: boolean }
  | { kind: 'sync_failed'; loading?: boolean }
  | { kind: 'na_rag'; loading?: boolean }
  | { kind: 'loading' };

export type PerplexityCitation =
  | { kind: 'cited'; rank: number; loading?: boolean }
  | { kind: 'omitted'; loading?: boolean }
  | { kind: 'sync_failed'; loading?: boolean }
  | { kind: 'na_rag'; loading?: boolean }
  | { kind: 'loading' };

export type LlmCitationFormat = 'inline_link' | 'text_mention' | 'omitted' | 'negative_context' | 'sync_failed' | 'na_rag' | 'loading';

export type LlmCitation = {
  kind: LlmCitationFormat;
  /** Sanitized markdown / snippet for display */
  snippet?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  snippetHash?: string;
  loading?: boolean;
};

export type CompetitorWinner = {
  engine: TrackedEngine;
  name: string;
  /** Linked citation URL when available */
  url?: string;
  /** Unlinked text mention fallback */
  textMention?: boolean;
  /** Cleaned Main Content DbRefId — never store raw scrape ids */
  mcRefId?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
};

export type CompetitorThreat =
  | {
      kind: 'threat';
      winners: CompetitorWinner[];
      dominantSentiment?: 'positive' | 'neutral' | 'negative';
    }
  | { kind: 'dominating' }
  | { kind: 'loading' };

export type RowSyncState = 'idle' | 'background_syncing' | 'failed';

export type VisibilityRow = {
  promptId: string;
  /** Client project this prompt belongs to — null for legacy demo seed rows */
  projectId?: string | null;
  prompt: string;
  promptCluster: string;
  aiSearchVol: number | null;
  /** Confirmed integer 0 suspends cron; NULL means unknown — never cast timeout as 0 */
  aiSearchVolConfirmed: boolean;
  organicRank: number | null;
  geoTarget: string;
  /** Standardized location id from onboarding — fallback via matchLocation on hydrate */
  geoLocationId?: string | null;
  geoTimezone: string;
  userTargetUrl: string;
  brandAliases: string[];
  persistenceTrend: SyncDotStatus[];
  /** Localized last-sync ISO; hydrate dates on the client to avoid UTC skew */
  lastSyncedAt: string;
  lastActionAt: string;
  updatedAt: string;
  nextCronRun: string | null;
  googleAio: GoogleAioCitation;
  perplexity: PerplexityCitation;
  chatgpt: LlmCitation;
  claude: LlmCitation;
  competitorThreat: CompetitorThreat;
  rowSyncState: RowSyncState;
  deepScanEnabled: boolean;
  suspended: boolean;
};

export type VisibilitySnapshot = {
  totalCitationShare: number;
  promptClustersTracked: number;
  top3CitationsSecured: number;
  competitorDeltaShareOfVoice: number;
  creditsUsed: number;
  creditsLimit: number;
  syncStatus: 'synced' | 'syncing' | 'stale' | 'error';
  lastUpdatedAt: string;
  deepScanEnabled: boolean;
  /** Active engines counted in share formula (excludes suspended prompts) */
  activeEngines: number;
  activeNonSuspendedPrompts: number;
};

export type VisibilityMatrixPage = {
  rows: VisibilityRow[];
  nextCursor: string | null;
  lastUpdatedAt: string;
  total: number;
};

export type VisibilityActionRoute =
  | 'pr-entity'
  | 'article-studio'
  | 'monitor'
  | 'optimize-engine';

export type VisibilityActionPayload = {
  sourceRoute: 'ai-visibility';
  /** Client project that owns this visibility prompt */
  projectId?: string;
  prompt: string;
  promptCluster: string;
  geoTarget: string;
  userTargetUrl: string;
  failedEngines: TrackedEngine[];
  /** Cleaned Main Content RefIDs only */
  targetCompetitorDbRefIds: string[];
  promptId: string;
  geoLocationId?: string;
  engine?: TrackedEngine;
};

/** Sanitized gap payload for Article Studio hydration */
export type VisibilityGapHydration = {
  promptId: string;
  prompt: string;
  promptCluster: string;
  geo: { locationId: string; label: string };
  keywordTargets: string[];
  targetEntities: string[];
  title: string;
  seoTitle: string;
  /** Tracked business/brand from visibility matrix — not workspace display name */
  trackedBrandName: string;
  brandWebsite: string;
  sourceRoute: 'ai-visibility';
};

export type VisibilityFiltersState = {
  search: string;
  promptCluster: string;
  engine: EngineFilter;
  device: DeviceEnvironment;
  chatGptMode: ChatGptMode;
  geoTarget: string;
  citationStatus: CitationStatusFilter;
};

export const AI_VISIBILITY_CACHE_KEY = 'ai-visibility-matrix-cache-v1';
export const AI_VISIBILITY_PREFILL_KEY = 'ai-visibility-prefill';
export const AI_VISIBILITY_AUTO_GENERATE_KEY = 'ai-visibility-auto-generate';
export const CLIENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const SYNC_FAILED_TTL_MS = 60 * 60 * 1000;
export const AI_VOLUME_TTL_DAYS = 30;
export const SCRAPE_BATCH_SIZE = 50;
export const MATRIX_PAGE_SIZE = 40;

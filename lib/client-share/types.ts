export const CLIENT_SHARE_REPORT_TYPES = [
  'rank_tracker',
  'ai_visibility',
  'page_audit',
] as const;

export type ClientShareReportType = (typeof CLIENT_SHARE_REPORT_TYPES)[number];

export type ClientShareSnapshotMeta = {
  clientBrandLabel: string;
  agencyName: string;
  reportLogoUrl: string | null;
  projectName: string;
  generatedAt: string;
};

export type RankTrackerShareSnapshot = {
  meta: ClientShareSnapshotMeta;
  summary: {
    visibilityScore: number;
    averageRank: string;
    top3Count: number;
    keywordCount: number;
  };
  keywords: Array<{
    keyword: string;
    currentRank: number | null;
    previousRank: number | null;
    searchVolume: number | null;
    intent: string;
    rankedUrl: string | null;
    location: string;
  }>;
};

export type AiVisibilityShareRow = {
  prompt: string;
  promptCluster: string;
  geoTarget: string;
  googleAio: string;
  perplexity: string;
  chatgpt: string;
  claude: string;
};

export type AiVisibilityShareSnapshot = {
  meta: ClientShareSnapshotMeta;
  metrics: {
    totalCitationShare: number;
    promptClustersTracked: number;
    top3CitationsSecured: number;
    competitorDeltaShareOfVoice: number;
    lastUpdatedAt: string;
    activeNonSuspendedPrompts: number;
  };
  rows: AiVisibilityShareRow[];
};

export type PageAuditShareSnapshot = {
  meta: ClientShareSnapshotMeta;
  audit: {
    auditId: number;
    url: string;
    targetKeyword: string;
    geoScore: number;
    createdAt: string;
    title: string | null;
    wordCount: number | null;
    headings: string[];
    analysisExcerpt: string | null;
    actionPlan: Array<{ title: string; reasoning: string }>;
  };
};

export type ClientShareSnapshot =
  | RankTrackerShareSnapshot
  | AiVisibilityShareSnapshot
  | PageAuditShareSnapshot;

export const CLIENT_SHARE_REPORT_LABELS: Record<ClientShareReportType, string> = {
  rank_tracker: 'Rank Tracker Snapshot',
  ai_visibility: 'AI Visibility Summary',
  page_audit: 'Page Audit Report',
};

export function isClientShareReportType(value: string): value is ClientShareReportType {
  return (CLIENT_SHARE_REPORT_TYPES as readonly string[]).includes(value);
}

import type { SemanticGap } from '@/lib/silo-builder/semantic-gaps';
import type { RankedKeywordRow } from '@/lib/silo-builder/dataforseo-ranked';
import type { HubGroup } from '@/lib/silo-builder/hub-groups';
import type {
  SiloKeywordSource,
  SiloMetricsConfidence,
} from '@/lib/silo-builder/metrics-confidence';

export type SiloProjectType = 'KEYWORD' | 'COMPETITOR';
export type SiloNodeType = 'PILLAR' | 'SPOKE';
export type SiloNodeStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'GENERATING'
  | 'COMPLETED'
  | 'PUBLISHED'
  | 'FAILED';

export type SiloLateralLink = {
  spokeTitle: string;
  suggestedLateralAnchorText: string;
};

export type SiloNodeGraphItem = {
  title: string;
  type: SiloNodeType;
  targetKeyword: string;
  intent?: string;
  summary?: string;
  funnelStage?: string;
  anchorTextToPillar?: string;
  lateralLinks?: SiloLateralLink[];
  semanticEntities?: string[];
  searchVolume?: number | null;
  difficulty?: number | null;
  originalTargetKeyword?: string | null;
  keywordSource?: SiloKeywordSource;
  metricsConfidence?: SiloMetricsConfidence;
  parentIndex?: number | null;
  suggestedInternalLinks?: string[];
  status?: SiloNodeStatus;
};

export type SiloKeywordMapResult = {
  pillar: SiloNodeGraphItem;
  spokes: SiloNodeGraphItem[];
};

export type SiloAttackMapResult = {
  semanticGaps: SemanticGap[];
  keywordsAnalyzed: number;
  rankedKeywords: RankedKeywordRow[];
  hubGroups: HubGroup[];
  pillar: SiloNodeGraphItem;
  spokes: SiloNodeGraphItem[];
};

export type SiloProjectSummary = {
  id: string;
  title: string;
  type: SiloProjectType;
  seedKeyword: string | null;
  domain: string | null;
  geography: string | null;
  nodeCount: number;
  createdAt: string;
};

export type SiloProjectDto = {
  id: string;
  title: string;
  type: SiloProjectType;
  domain: string | null;
  seedKeyword: string | null;
  geography: string | null;
  niche: string | null;
  integrationId: string | null;
  semanticGaps: SemanticGap[];
  keywordsAnalyzed: number | null;
  rankedKeywords: RankedKeywordRow[];
  hubGroups: HubGroup[];
  importedFromTopicalMapId: string | null;
  metricsStatus: 'complete' | 'partial' | 'failed' | 'never' | 'enriching';
  metricsEnrichedAt: string | null;
  metricsCompleteCount: number;
  metricsTotalCount: number;
  createdAt: string;
  updatedAt: string;
  nodes: SiloNodeDto[];
};

export type SiloNodeDto = {
  id: string;
  projectId: string;
  title: string;
  type: SiloNodeType;
  targetKeyword: string | null;
  originalTargetKeyword: string | null;
  keywordSource: SiloKeywordSource | null;
  metricsConfidence: SiloMetricsConfidence | null;
  searchVolume: number | null;
  difficulty: number | null;
  enrichedAt: string | null;
  intent: string | null;
  summary: string | null;
  funnelStage: string | null;
  anchorTextToPillar: string | null;
  lateralLinks: SiloLateralLink[];
  semanticEntities: string[];
  status: SiloNodeStatus;
  parentId: string | null;
  content: string | null;
  slug: string | null;
  wpPostId: number | null;
  wpPostStatus: 'draft' | 'publish' | null;
  articleStudioHistoryId: string | null;
  publishedAt: string | null;
};

export type WordPressSiteOption = {
  integrationId: string;
  label: string;
  siteUrl: string;
};

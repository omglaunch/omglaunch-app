import type { HubSpokeMap } from '@/lib/hub-spoke-data';
import type { ReverseEngineerProgressStep } from '@/lib/competitor-intel/constants';

export type PrunedCompetitorKeyword = {
  keyword: string;
  searchVolume: number | null;
  rank: number | null;
};

export type SemanticGap = {
  topic: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
};

export type CompetitorIntelResult = {
  map: HubSpokeMap;
  semanticGaps: SemanticGap[];
  competitorDomain: string;
  coreNiche: string;
  targetCountry: string;
  keywordsAnalyzed: number;
  mapId: string;
};

export type ReverseEngineerTaskMetadata = {
  step: ReverseEngineerProgressStep;
  targetDomain?: string;
  coreNiche?: string;
  targetCountry?: string;
  workspaceId?: string;
  competitorDomain?: string;
  keywordsAnalyzed?: number;
  mapId?: string;
  semanticGaps?: SemanticGap[];
  errorCode?: string;
  errorMessage?: string;
};

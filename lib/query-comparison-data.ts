export type CannibalizationRisk = 'Low' | 'Medium' | 'High';

export type FunnelStage = 'TOFU' | 'MOFU' | 'BOFU';

export type QueryComparisonFunnelComparison = {
  queryAStage: FunnelStage;
  queryBStage: FunnelStage;
};

export type QueryComparisonResult = {
  queryA: string;
  queryB: string;
  overlapScore: number;
  intentMatch: boolean;
  cannibalizationRisk: CannibalizationRisk;
  funnelComparison: QueryComparisonFunnelComparison;
  serpLayoutExpectation: string;
  recommendation: string;
  detailedAnalysis: string;
};

const VALID_CANNIBALIZATION_RISKS = new Set<string>(['Low', 'Medium', 'High']);
const VALID_FUNNEL_STAGES = new Set<string>(['TOFU', 'MOFU', 'BOFU']);

function isFunnelComparison(value: unknown): value is QueryComparisonFunnelComparison {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as QueryComparisonFunnelComparison;

  return (
    typeof candidate.queryAStage === 'string' &&
    VALID_FUNNEL_STAGES.has(candidate.queryAStage) &&
    typeof candidate.queryBStage === 'string' &&
    VALID_FUNNEL_STAGES.has(candidate.queryBStage)
  );
}

export function isQueryComparisonResult(value: unknown): value is QueryComparisonResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as QueryComparisonResult;

  return (
    typeof candidate.queryA === 'string' &&
    candidate.queryA.trim().length > 0 &&
    typeof candidate.queryB === 'string' &&
    candidate.queryB.trim().length > 0 &&
    typeof candidate.overlapScore === 'number' &&
    Number.isFinite(candidate.overlapScore) &&
    candidate.overlapScore >= 0 &&
    candidate.overlapScore <= 100 &&
    typeof candidate.intentMatch === 'boolean' &&
    typeof candidate.cannibalizationRisk === 'string' &&
    VALID_CANNIBALIZATION_RISKS.has(candidate.cannibalizationRisk) &&
    isFunnelComparison(candidate.funnelComparison) &&
    typeof candidate.serpLayoutExpectation === 'string' &&
    candidate.serpLayoutExpectation.trim().length > 0 &&
    typeof candidate.recommendation === 'string' &&
    candidate.recommendation.trim().length > 0 &&
    typeof candidate.detailedAnalysis === 'string' &&
    candidate.detailedAnalysis.trim().length > 0
  );
}

export function isQueryComparisonHistoryData(value: unknown): value is QueryComparisonResult {
  return isQueryComparisonResult(value);
}

export function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function parseQueryComparisonJson(text: string): QueryComparisonResult {
  const cleaned = stripMarkdownJsonFence(text);
  const parsed = JSON.parse(cleaned) as unknown;

  if (!isQueryComparisonResult(parsed)) {
    throw new Error('Generated comparison did not match the required schema');
  }

  return parsed;
}

export function buildHistoryIdentifier(queryA: string, queryB: string): string {
  return `${queryA.trim()} vs ${queryB.trim()}`;
}

/** UI-derived cannibalization risk from overlap score + page targeting decision. */
export function deriveCannibalizationRisk(
  overlapScore: number,
  intentMatch: boolean
): CannibalizationRisk {
  if (overlapScore <= 30) {
    return 'Low';
  }
  if (overlapScore <= 70) {
    return 'Medium';
  }
  if (intentMatch) {
    return 'High';
  }
  return 'Medium';
}

export type OverlapVisualSeverity = 'safe' | 'caution' | 'collision';

/** Maps overlap score to ring/text severity — low overlap is calm, high overlap is alarming. */
export function getOverlapVisualSeverity(overlapScore: number): OverlapVisualSeverity {
  if (overlapScore <= 30) {
    return 'safe';
  }
  if (overlapScore <= 70) {
    return 'caution';
  }
  return 'collision';
}

export function overlapSummaryText(overlapScore: number, intentMatch: boolean): string {
  if (overlapScore <= 30) {
    return 'Distinct intents — separate pages are safe';
  }
  if (overlapScore <= 70) {
    return 'Partial intent overlap — structure carefully';
  }
  if (intentMatch) {
    return 'Strong overlap — splitting these queries risks self-cannibalization';
  }
  return 'High overlap but distinct page targets — monitor for bleed';
}

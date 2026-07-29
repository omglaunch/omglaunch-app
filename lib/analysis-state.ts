import type { AnalysisMetrics } from '@/lib/analysis-data';
import type { AuditData } from '@/lib/audit-data';
import { isTermUsageHealthy } from '@/lib/semantic-scoring';
import type { SemanticAnalysisResult, SemanticCriterion } from '@/lib/semantic-metrics';

export type AuditReportData = {
  id?: number;
  url: string;
  targetKeyword: string;
  geoScore: number;
  createdAt?: string;
  data: AuditData;
};

export type AnalysisSession = {
  url: string;
  keyword: string;
  locationCode: number;
};

/** DataForSEO location code for Malaysia — default for semantic analysis. */
export const DEFAULT_SEMANTIC_LOCATION_CODE = 2458;

export type AnalysisLocationOption = {
  code: number;
  label: string;
};

/** Malaysia first; Global (USA) last. */
export const ANALYSIS_LOCATION_OPTIONS: AnalysisLocationOption[] = [
  { code: 2458, label: 'Malaysia' },
  { code: 2702, label: 'Singapore' },
  { code: 2360, label: 'Indonesia' },
  { code: 2764, label: 'Thailand' },
  { code: 2704, label: 'Vietnam' },
  { code: 2608, label: 'Philippines' },
  { code: 2840, label: 'Global (USA)' },
];

export function normalizeAnalysisUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim().replace(/\/$/, '');
  }
}

export function sessionsMatch(
  session: AnalysisSession | null,
  url: string,
  keyword: string
): boolean {
  if (!session) return false;

  return (
    normalizeAnalysisUrl(session.url) === normalizeAnalysisUrl(url) &&
    session.keyword.trim().toLowerCase() === keyword.trim().toLowerCase()
  );
}

export function getTechnicalCheckScore(
  technicalData: AnalysisMetrics | null,
  question: string
): number | null {
  if (!technicalData) return null;

  const check = technicalData.checks.find(entry => entry.question === question);
  return check?.score ?? null;
}

export function isJsonLdValid(technicalData: AnalysisMetrics | null): boolean | null {
  const score = getTechnicalCheckScore(technicalData, 'Does the page have valid JSON-LD?');
  if (score === null) return null;
  return score >= 100;
}

export function getReadabilityScore(technicalData: AnalysisMetrics | null): number | null {
  return getTechnicalCheckScore(technicalData, 'Is the content easy to read?');
}

export function getTopSemanticGaps(semanticResult: SemanticAnalysisResult | null): SemanticCriterion[] {
  if (!semanticResult) return [];

  return semanticResult.criteria
    .filter(
      criterion =>
        criterion.occurrence.current === 0 ||
        !isTermUsageHealthy(criterion.occurrence, criterion.idealOccurrence)
    )
    .sort((a, b) => b.interestScore - a.interestScore)
    .slice(0, 5);
}

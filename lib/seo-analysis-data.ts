export type SeoCriterionStatus = 'pass' | 'warning' | 'fail';

export interface SeoCriterion {
  id: string;
  label: string;
  value: string | number;
  status: SeoCriterionStatus;
  subtext?: string;
}

export interface KeywordFrequency {
  text: string;
  value: number;
}

export interface SeoAnalysisMetrics {
  url: string;
  overallScore: number;
  criteria: SeoCriterion[];
  keywordFrequencies: KeywordFrequency[];
}

export function seoStatusTextClass(status: SeoCriterionStatus): string {
  switch (status) {
    case 'pass':
      return 'text-emerald-600';
    case 'warning':
      return 'text-amber-600';
    case 'fail':
      return 'text-red-600';
  }
}

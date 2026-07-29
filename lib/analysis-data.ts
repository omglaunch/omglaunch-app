export interface AnalysisCheck {
  question: string;
  score: number;
  category?: string;
}

export interface AnalysisMetrics {
  url: string;
  overallScore: number;
  summaryText: string;
  checks: AnalysisCheck[];
}

export type ScoreBarVariant = 'green' | 'yellow' | 'orange' | 'red' | 'gray';

export function getScoreBarVariant(score: number): ScoreBarVariant {
  if (score === 0) return 'gray';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellow';
  if (score >= 60) return 'orange';
  return 'red';
}

export function scoreBarFillClass(variant: ScoreBarVariant): string {
  switch (variant) {
    case 'green':
      return 'bg-emerald-500';
    case 'yellow':
      return 'bg-yellow-400';
    case 'orange':
      return 'bg-orange-500';
    case 'red':
      return 'bg-red-500';
    case 'gray':
      return 'bg-gray-300';
  }
}

export function scoreBarTextClass(variant: ScoreBarVariant): string {
  switch (variant) {
    case 'green':
      return 'text-emerald-600';
    case 'yellow':
      return 'text-yellow-600';
    case 'orange':
      return 'text-orange-600';
    case 'red':
      return 'text-red-600';
    case 'gray':
      return 'text-gray-400';
  }
}

export function overallScoreBarFillClass(score: number): string {
  const variant = getScoreBarVariant(score);
  if (variant === 'green') return 'bg-gradient-to-r from-emerald-400 to-emerald-500';
  if (variant === 'yellow') return 'bg-gradient-to-r from-yellow-400 to-yellow-500';
  if (variant === 'orange') return 'bg-gradient-to-r from-orange-400 to-orange-500';
  if (variant === 'red') return 'bg-gradient-to-r from-red-400 to-red-500';
  return 'bg-gray-300';
}

export function overallScoreTextClass(score: number): string {
  return scoreBarTextClass(getScoreBarVariant(score));
}

export function overallScoreRingClass(score: number): string {
  switch (getScoreBarVariant(score)) {
    case 'green':
      return 'stroke-emerald-500';
    case 'yellow':
      return 'stroke-yellow-500';
    case 'orange':
      return 'stroke-orange-500';
    case 'red':
      return 'stroke-red-500';
    case 'gray':
      return 'stroke-gray-300';
  }
}

export function overallScoreRingStrokeColor(score: number): string {
  switch (getScoreBarVariant(score)) {
    case 'green':
      return '#10b981';
    case 'yellow':
      return '#eab308';
    case 'orange':
      return '#f97316';
    case 'red':
      return '#ef4444';
    case 'gray':
      return '#d1d5db';
  }
}

export function buildImprovementSubtext(checks: AnalysisCheck[]): string {
  const weakAreas = checks
    .filter(check => check.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map(check => check.question.replace(/\?$/, '').toLowerCase());

  if (weakAreas.length === 0) {
    return 'All AI-readiness checks are performing well.';
  }

  if (weakAreas.length === 1) {
    return `The main area for improvement is ${weakAreas[0]}.`;
  }

  return `The main areas for improvement are ${weakAreas[0]} and ${weakAreas[1]}.`;
}

import type { AnalysisCheck, AnalysisMetrics } from './analysis-data';

const CHECK_QUESTIONS: Pick<AnalysisCheck, 'question' | 'category'>[] = [
  { question: 'Is the page well structured?', category: 'structure' },
  { question: 'Does the page include descriptive images?', category: 'content' },
  { question: 'Does the page have valid JSON-LD?', category: 'structured-data' },
  { question: 'Is the page well segmented?', category: 'structure' },
  { question: 'Is the content easy to read?', category: 'content' },
  { question: 'Is the markup semantically consistent?', category: 'markup' },
  { question: 'Does the page have a table of contents?', category: 'navigation' },
  { question: 'Does the page offer a concise summary?', category: 'content' },
  { question: 'Does the page load quickly?', category: 'performance' },
  { question: 'Is the content accessible without JavaScript?', category: 'accessibility' },
  { question: 'Is the robots.txt file complete?', category: 'technical' },
];

function randomScore(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function randomCheckScore(question: string): number {
  if (question.includes('table of contents')) {
    return Math.random() < 0.35 ? 0 : randomScore(40, 75);
  }
  if (question.includes('load quickly')) {
    return randomScore(45, 70);
  }
  if (question.includes('semantically consistent')) {
    return randomScore(55, 75);
  }
  if (question.includes('concise summary')) {
    return randomScore(65, 80);
  }
  if (question.includes('without JavaScript')) {
    return randomScore(85, 100);
  }
  return randomScore(75, 100);
}

function buildSummaryText(overallScore: number): string {
  if (overallScore >= 85) {
    return 'This page is well optimized for AI, with only minor areas for improvement.';
  }
  if (overallScore >= 70) {
    return 'This page is well optimized for AI, with a few minor areas for improvement.';
  }
  if (overallScore >= 55) {
    return 'This page has a solid AI-readiness foundation, but several areas need attention.';
  }
  return 'This page needs significant improvements before it is fully AI-ready.';
}

/**
 * Temporary mock provider for Analysis AI UI development.
 * Returns randomized scores around realistic ranges for each check.
 */
export function getMockAnalysisMetrics(
  url = 'https://example.com/target-page'
): AnalysisMetrics {
  const checks: AnalysisCheck[] = CHECK_QUESTIONS.map(({ question, category }) => ({
    question,
    category,
    score: randomCheckScore(question),
  }));

  const overallScore =
    Math.round(
      (checks.reduce((sum, check) => sum + check.score, 0) / checks.length) * 10
    ) / 10;

  return {
    url,
    overallScore,
    summaryText: buildSummaryText(overallScore),
    checks,
  };
}

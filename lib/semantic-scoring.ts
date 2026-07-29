import type { SemanticCriterion, SemanticIdealRange, SemanticOccurrence } from '@/lib/semantic-metrics';

export type CompetitorPageSnapshot = {
  url: string;
  bodyText: string;
  wordCount: number;
};

export type ExpressionCompetitorBenchmark = {
  avgDensity: number;
  avgFrequency: number;
  avgWordCount: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;

  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower] ?? 0;
  }

  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

export function filterWordCountOutliers<T extends { wordCount: number }>(pages: T[]): T[] {
  if (pages.length < 4) return pages;

  const counts = pages.map(page => page.wordCount).sort((a, b) => a - b);
  const q1 = percentile(counts, 0.25);
  const q3 = percentile(counts, 0.75);
  const iqr = q3 - q1;

  if (iqr <= 0) return pages;

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = pages.filter(page => page.wordCount >= lower && page.wordCount <= upper);

  return filtered.length >= 2 ? filtered : pages;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeExpressionBenchmark(
  pages: CompetitorPageSnapshot[],
  frequencyForPage: (page: CompetitorPageSnapshot) => number
): ExpressionCompetitorBenchmark {
  if (pages.length === 0) {
    return { avgDensity: 0, avgFrequency: 0, avgWordCount: 0 };
  }

  const frequencies = pages.map(frequencyForPage);
  const densities = pages
    .filter(page => page.wordCount > 0)
    .map(page => frequencyForPage(page) / page.wordCount);

  return {
    avgDensity: average(densities),
    avgFrequency: average(frequencies),
    avgWordCount: average(pages.map(page => page.wordCount)),
  };
}

export function deriveFallbackIdealOccurrence(
  targetPageWordCount: number,
  relevanceWeight: number,
  isTargetKeyword: boolean
): { min: number; max: number; maxCompetition: number } {
  const density = isTargetKeyword ? 0.004 : 0.001 + relevanceWeight * 0.0015;
  const idealCenter = Math.max(1, Math.round(density * targetPageWordCount));
  const min = Math.max(1, Math.round(idealCenter * 0.65));
  const max = Math.max(min + 1, Math.round(idealCenter * 1.35));

  return { min, max, maxCompetition: idealCenter };
}

export function deriveIdealOccurrenceFromDensity(
  targetPageWordCount: number,
  benchmark: ExpressionCompetitorBenchmark,
  relevanceWeight: number,
  isTargetKeyword: boolean
): { min: number; max: number; maxCompetition: number } {
  if (benchmark.avgDensity <= 0 && benchmark.avgFrequency <= 0) {
    return deriveFallbackIdealOccurrence(targetPageWordCount, relevanceWeight, isTargetKeyword);
  }

  let idealCenter = Math.max(1, Math.round(benchmark.avgDensity * targetPageWordCount));

  if (idealCenter <= 1 && benchmark.avgFrequency > 0) {
    const scaledFromAverage = Math.max(
      1,
      Math.round((benchmark.avgFrequency / Math.max(benchmark.avgWordCount, 1)) * targetPageWordCount)
    );
    idealCenter = Math.max(idealCenter, scaledFromAverage);
  }

  const min = Math.max(1, Math.round(idealCenter * 0.65));
  const max = Math.max(min, Math.round(idealCenter * 1.35));
  const maxCompetition = Math.max(1, Math.round(benchmark.avgFrequency));

  return { min, max, maxCompetition };
}

export function computeTermCoverageScore(criterion: SemanticCriterion): number {
  const { current } = criterion.occurrence;
  if (current === 0) return 0;

  const presenceBase = 72;
  const { min, max } = criterion.idealOccurrence;

  let alignmentBonus = 0;
  if (current >= min && current <= max) {
    alignmentBonus = 28;
  } else if (current < min) {
    alignmentBonus = 22;
  } else {
    const overshootRatio = current / Math.max(max, 1);
    alignmentBonus = overshootRatio <= 1.5 ? 18 : Math.max(8, 18 - (overshootRatio - 1.5) * 20);
  }

  return Math.min(100, presenceBase + alignmentBonus);
}

export function computeSemanticScore(criteria: SemanticCriterion[]): number {
  if (criteria.length === 0) return 0;

  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + Math.max(criterion.interestScore, 1),
    0
  );

  const weightedSum = criteria.reduce((sum, criterion) => {
    const weight = Math.max(criterion.interestScore, 1);
    return sum + computeTermCoverageScore(criterion) * weight;
  }, 0);

  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

export function isTermUsageHealthy(
  occurrence: SemanticOccurrence,
  idealOccurrence: SemanticIdealRange
): boolean {
  if (occurrence.current === 0) return false;

  const overuseLimit = Math.max(
    idealOccurrence.max * 1.75,
    idealOccurrence.max + 2,
    occurrence.maxCompetition * 2
  );

  return occurrence.current <= overuseLimit;
}

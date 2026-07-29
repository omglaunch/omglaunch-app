import type { GridSize } from './types';

export const GEOGRID_CREDIT_COSTS: Record<GridSize, number> = {
  3: 5,
  5: 12,
  7: 25,
};

export const SERVICE_AREA_CREDIT_COST_PER_CITY = 3;
export const CITATION_AUDIT_CREDIT_COST = 8;
export const REVIEW_RESPONSE_CREDIT_COST = 2;

export const GRID_SIZE_OPTIONS: GridSize[] = [3, 5, 7];

export const SOLV_ANOMALY_THRESHOLD = 0.15;

export const OPENAI_CONCURRENCY_LIMIT = 5;

export const GEMINI_SPAM_MODEL = 'gemini-1.5-pro';
export const OPENAI_MICRO_GRID_MODEL = 'gpt-4o-mini';
export const PERPLEXITY_MODEL = 'sonar';

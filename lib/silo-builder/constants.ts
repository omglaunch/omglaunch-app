export const SILO_KEYWORD_MAP_CREDIT_COST = 50;
export const SILO_COMPETITOR_ATTACK_CREDIT_COST = 100;
export const SILO_CONTENT_GENERATION_CREDIT_COST = 15;

export const SILO_GEMINI_MODEL = 'gemini-2.5-flash';

export const SILO_GENERATION_TASK_TYPE = 'SILO_CONTENT_GENERATION';
export const SILO_COMPETITOR_ATTACK_TASK_TYPE = 'SILO_COMPETITOR_ATTACK';
export const SILO_METRICS_ENRICH_TASK_TYPE = 'SILO_METRICS_ENRICH';

/** Progressive Labs enrich chunk size — match overview batch (100) to avoid task amplification. */
export const SILO_METRICS_ENRICH_CHUNK_SIZE = 100;

/** Reclaim a stuck enriching lock after this many ms. */
export const SILO_METRICS_ENRICH_LOCK_STALE_MS = 10 * 60 * 1000;

/** Shared with Competitor Intel — API `errorCode` when DataForSEO returns 0 ranked keywords. */
export const ZERO_COMPETITOR_KEYWORDS_ERROR = 'ZERO_COMPETITOR_KEYWORDS';

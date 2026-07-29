/** Live AI Visibility Force Sync — cost & model knobs. */

/** App credits charged per engine when master (platform) keys are used. */
export const AI_VISIBILITY_CREDIT_PER_ENGINE = 1;

export const AI_VISIBILITY_OPENAI_MODEL = 'gpt-4o-mini';
/** Cost-aware default for visibility probes (not full Sonnet generation). */
export const AI_VISIBILITY_ANTHROPIC_MODEL = 'claude-3-5-haiku-latest';
export const AI_VISIBILITY_PERPLEXITY_MODEL = 'sonar';

/** Engines wired for live Force Sync. Google AIO stays deferred. */
export const LIVE_FORCE_SYNC_ENGINES = [
  'perplexity',
  'chatgpt',
  'claude',
] as const;

export type LiveForceSyncEngine = (typeof LIVE_FORCE_SYNC_ENGINES)[number];

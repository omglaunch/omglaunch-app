export const COMPETITOR_INTEL_COUNTRIES = [
  'Malaysia',
  'United States',
  'United Kingdom',
  'Australia',
  'Canada',
  'Singapore',
] as const;

export type CompetitorIntelCountry = (typeof COMPETITOR_INTEL_COUNTRIES)[number];

export const DEFAULT_COMPETITOR_INTEL_COUNTRY: CompetitorIntelCountry = 'Malaysia';

export const REVERSE_ENGINEER_CREDIT_COST = 100;

export const REVERSE_ENGINEER_TASK_TYPE = 'COMPETITOR_REVERSE_ENGINEER';

export type ReverseEngineerProgressStep =
  | 'queued'
  | 'scraping'
  | 'analyzing'
  | 'architecting'
  | 'saving'
  | 'enriching'
  | 'complete';

export const REVERSE_ENGINEER_PROGRESS_LABELS: Record<
  ReverseEngineerProgressStep,
  string
> = {
  queued: 'Initializing telemetry…',
  scraping: 'Scraping Telemetry…',
  analyzing: 'Analyzing Clusters…',
  architecting: 'Architecting Attack…',
  saving: 'Persisting strategy…',
  enriching: 'Enriching keyword metrics…',
  complete: 'Attack map ready',
};

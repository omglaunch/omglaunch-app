import type { KeywordAuditGeoInput } from '@/lib/keyword-audit/geo';
import type { ScrapeMethod } from '@/lib/scraper';

export type { ScrapeMethod } from '@/lib/scraper';

export type TrustSignals = {
  outboundLinks: number;
  quotes: number;
  statistics: number;
};

export type ComparePageMetrics = {
  url: string;
  label: string;
  title: string;
  headings: string[];
  geoScore: number | null;
  geoScoreError?: string;
  /** True when scraping failed but the column should still render for this URL slot */
  analysisFailed?: boolean;
  /** True when Puppeteer could not scrape this URL; keeps array slots aligned */
  scrapeError?: boolean;
  wordCount: number;
  headingCount: number;
  images: {
    total: number;
    missingAlt: number;
    backgroundImages?: number;
  };
  trustSignals: TrustSignals;
  bodyText: string;
  /** JSON-LD @type values detected on the page (FAQPage, Article, Product, etc.) */
  schemaTypes?: string[];
  /** Flesch-Kincaid grade level derived from body text */
  readabilityGrade?: number | null;
  /** Page-level referring domains (placeholder until backlink API is wired) */
  pageReferringDomains?: number | null;
  /** Mobile Lighthouse-style performance score 0–100 (placeholder) */
  mobilePageSpeed?: number | null;
  /** How this page was scraped — live headless browser vs static HTML fallback. */
  scrapeMethod?: ScrapeMethod;
};

export type SemanticMarketGapRow = {
  entity: string;
  entityType: string;
  /** Gemini-derived coverage flags, aligned with the competitors array */
  competitorCovers: boolean[];
  competitorCoverageCount: number;
  competitorCoverageTotal: number;
  competitorCoveragePercent: number;
};

export type CompetitiveStrategyPlan = {
  criticalGapFocus: string;
  structuralRecommendation: string;
  nextBestAction: string;
};

export type CompetitorCompareResult = {
  targetKeyword: string;
  yourPage: ComparePageMetrics;
  competitors: ComparePageMetrics[];
  semanticGaps: SemanticMarketGapRow[];
  strategyPlan: CompetitiveStrategyPlan | null;
  analyzedAt: string;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  /** Market used when Vol/KD were fetched from DataForSEO. */
  metricsGeo?: KeywordAuditGeoInput;
};

export function formatCompetitorCoverage(gap: SemanticMarketGapRow): string {
  return `${gap.competitorCoverageCount} of ${gap.competitorCoverageTotal} competitors`;
}

export function formatCompetitorCoveragePercent(gap: SemanticMarketGapRow): string {
  return `${gap.competitorCoveragePercent}% of competitors`;
}

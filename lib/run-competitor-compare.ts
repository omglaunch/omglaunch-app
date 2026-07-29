import {
  extractSemanticMarketGapsWithGemini,
  generateCompetitiveStrategyPlan,
} from '@/lib/competitor-compare-ai';
import type { CompetitorCompareResult, ComparePageMetrics } from '@/lib/competitor-compare-data';
import {
  createScrapeErrorMetrics,
  ensureCompetitorSlotIntegrity,
  isInvalidComparePage,
} from '@/lib/competitor-scrape-errors';
import { buildCompareGeoScoreInput, computeCompareGeoScore } from '@/lib/competitor-compare-geo';
import {
  computeFleschKincaidGradeLevel,
  deriveMobilePageSpeedPlaceholder,
  derivePageReferringDomainsPlaceholder,
} from '@/lib/competitor-compare-metrics';
import { sanitizeBodyText } from '@/lib/scrape-content';
import type { ScrapePageData } from '@/lib/scraper';

export type RunCompetitorCompareInput = {
  targetKeyword: string;
  yourUrl: string;
  competitorUrls: string[];
  workspaceId?: string;
  country?: string;
  city?: string;
  language?: string;
  device?: string;
};

/** Scrapes one competitor slot, returning a standardized error object on failure. */
export async function scrapeSingleCompetitorSlot(
  url: string,
  index: number,
  scrapePageData: (url: string) => Promise<ScrapePageData>
): Promise<ComparePageMetrics> {
  try {
    const page = await scrapeComparePage(url, `Comp ${index + 1}`, scrapePageData);

    if (isInvalidComparePage(page)) {
      return createScrapeErrorMetrics(url, index, 'Failed to scrape');
    }

    return { ...page };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze URL';
    return createScrapeErrorMetrics(url, index, message);
  }
}

export function normalizeCompetitorUrls(urls: string[]): string[] {
  return urls.map(normalizeUrlInput).filter(Boolean).slice(0, 3);
}

function normalizeUrlInput(url: string): string {
  return url.trim();
}

function validateUrl(url: string): URL {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`URL must use http or https: ${url}`);
  }
  return parsed;
}

function computeGeoScoreForPage(
  pageMetrics: {
    url: string;
    title: string;
    headings: string[];
    wordCount: number;
    headingCount: number;
    images: { total: number; missingAlt: number };
    trustSignals: ComparePageMetrics['trustSignals'];
  },
  targetKeyword: string
): number {
  return computeCompareGeoScore(buildCompareGeoScoreInput(pageMetrics), targetKeyword);
}

function isInvalidScrapedPage(scraped: ScrapePageData | null | undefined): boolean {
  if (!scraped || typeof scraped !== 'object') {
    return true;
  }

  if (Object.keys(scraped).length === 0) {
    return true;
  }

  const hasUrl = typeof scraped.url === 'string' && scraped.url.trim().length > 0;
  const hasContent =
    Boolean(scraped.title?.trim()) ||
    Boolean(scraped.bodyText?.trim()) ||
    (Array.isArray(scraped.headings) && scraped.headings.length > 0);

  return !hasUrl || !hasContent;
}

async function scrapeComparePage(
  url: string,
  label: string,
  scrapePageData: (url: string) => Promise<ScrapePageData>
): Promise<ComparePageMetrics> {
  const parsed = validateUrl(url);
  const scraped = await scrapePageData(parsed.href);

  if (isInvalidScrapedPage(scraped)) {
    throw new Error('Failed to scrape');
  }

  const bodyText = sanitizeBodyText(scraped.bodyText);

  const pageMetrics = {
    url: parsed.href,
    title: scraped.title,
    headings: [...scraped.headings],
    wordCount: scraped.wordCount,
    headingCount: scraped.headings.length,
    images: {
      total: scraped.images.total,
      missingAlt: scraped.images.missingAlt,
      backgroundImages: scraped.images.backgroundImages,
    },
    trustSignals: {
      outboundLinks: scraped.trustSignals.outboundLinks,
      quotes: scraped.trustSignals.quotes,
      statistics: scraped.trustSignals.statistics,
    },
    schemaTypes: scraped.schemaTypes ?? [],
    readabilityGrade: computeFleschKincaidGradeLevel(bodyText),
    pageReferringDomains: derivePageReferringDomainsPlaceholder(parsed.href),
    mobilePageSpeed: deriveMobilePageSpeedPlaceholder(parsed.href, scraped.wordCount),
  };

  return {
    url: pageMetrics.url,
    label,
    title: pageMetrics.title,
    headings: pageMetrics.headings,
    geoScore: null,
    wordCount: pageMetrics.wordCount,
    headingCount: pageMetrics.headingCount,
    images: pageMetrics.images,
    trustSignals: pageMetrics.trustSignals,
    bodyText,
    schemaTypes: pageMetrics.schemaTypes,
    readabilityGrade: pageMetrics.readabilityGrade,
    pageReferringDomains: pageMetrics.pageReferringDomains,
    mobilePageSpeed: pageMetrics.mobilePageSpeed,
    scrapeMethod: scraped.scrapeMethod,
  };
}

function assignGeoScoresInPlace(
  pages: ComparePageMetrics[],
  targetKeyword: string
): void {
  for (const page of pages) {
    if (page.analysisFailed || page.scrapeError) {
      page.geoScore = 0;
      continue;
    }

    page.geoScore = computeGeoScoreForPage(
      {
        url: page.url,
        title: page.title,
        headings: page.headings,
        wordCount: page.wordCount,
        headingCount: page.headingCount,
        images: page.images,
        trustSignals: page.trustSignals,
      },
      targetKeyword
    );
  }
}

export async function runCompetitorCompare(
  input: RunCompetitorCompareInput,
  scrapePageData: (url: string) => Promise<ScrapePageData>,
  prefetchedCompetitors?: ComparePageMetrics[]
): Promise<CompetitorCompareResult> {
  const targetKeyword = input.targetKeyword.trim();
  const yourUrl = normalizeUrlInput(input.yourUrl);
  const competitorUrls = normalizeCompetitorUrls(input.competitorUrls);

  if (!yourUrl) {
    throw new Error('Your URL is required');
  }
  if (competitorUrls.length === 0) {
    throw new Error('At least one competitor URL is required');
  }

  validateUrl(yourUrl);
  competitorUrls.forEach(validateUrl);

  let alignedCompetitors = prefetchedCompetitors;

  if (!alignedCompetitors) {
    const competitors: ComparePageMetrics[] = [];

    for (let index = 0; index < competitorUrls.length; index++) {
      const url = competitorUrls[index];
      competitors.push(await scrapeSingleCompetitorSlot(url, index, scrapePageData));
    }

    alignedCompetitors = ensureCompetitorSlotIntegrity(competitors, competitorUrls);
  }

  const successfulCompetitors = alignedCompetitors.filter(
    competitor => !competitor.analysisFailed && !competitor.scrapeError
  );

  if (successfulCompetitors.length === 0) {
    throw new Error('None of the competitor URLs could be analyzed. Check the URLs and try again.');
  }

  let yourPage: ComparePageMetrics;
  try {
    yourPage = await scrapeComparePage(yourUrl, 'Your App', scrapePageData);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to analyze your URL');
  }

  assignGeoScoresInPlace([yourPage, ...alignedCompetitors], targetKeyword);

  const semanticGaps = await extractSemanticMarketGapsWithGemini(
    yourPage,
    alignedCompetitors,
    targetKeyword
  ).catch(() => []);

  const strategyPlan = await generateCompetitiveStrategyPlan({
    targetKeyword,
    yourPage,
    competitors: alignedCompetitors,
    semanticGaps,
    analyzedAt: new Date().toISOString(),
  }).catch(() => null);

  return {
    targetKeyword,
    yourPage: { ...yourPage },
    competitors: alignedCompetitors.map(competitor => ({ ...competitor })),
    semanticGaps,
    strategyPlan,
    analyzedAt: new Date().toISOString(),
  };
}

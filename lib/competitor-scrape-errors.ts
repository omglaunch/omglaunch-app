import type { ComparePageMetrics } from '@/lib/competitor-compare-data';

function normalizeFailedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return url;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function createScrapeErrorMetrics(
  url: string,
  index: number,
  errorMessage = 'Failed to scrape'
): ComparePageMetrics {
  return {
    url: normalizeFailedUrl(url),
    label: `Comp ${index + 1}`,
    title: '(unavailable)',
    headings: [],
    geoScore: 0,
    geoScoreError: errorMessage,
    analysisFailed: true,
    scrapeError: true,
    wordCount: 0,
    headingCount: 0,
    images: { total: 0, missingAlt: 0 },
    trustSignals: { outboundLinks: 0, quotes: 0, statistics: 0 },
    bodyText: '',
    schemaTypes: [],
    readabilityGrade: null,
    pageReferringDomains: null,
    mobilePageSpeed: null,
  };
}

export function isInvalidComparePage(page: ComparePageMetrics | null | undefined): boolean {
  if (!page || typeof page !== 'object') {
    return true;
  }

  if (Object.keys(page).length === 0) {
    return true;
  }

  if (page.scrapeError || page.analysisFailed) {
    return false;
  }

  return !page.url?.trim();
}

export function ensureCompetitorSlotIntegrity(
  competitors: ComparePageMetrics[],
  competitorUrls: string[]
): ComparePageMetrics[] {
  return competitorUrls.map((url, index) => {
    const candidate = competitors[index];
    if (candidate && !isInvalidComparePage(candidate)) {
      return {
        ...candidate,
        label: `Comp ${index + 1}`,
      };
    }

    const message =
      candidate?.geoScoreError ??
      (candidate && isInvalidComparePage(candidate) ? 'Failed to scrape' : 'Failed to scrape');
    return createScrapeErrorMetrics(url, index, message);
  });
}

import { NextResponse } from 'next/server';
import type { ComparePageMetrics } from '@/lib/competitor-compare-data';
import { ensureCompetitorSlotIntegrity } from '@/lib/competitor-scrape-errors';
import { fetchKeywordAuditSeoMetrics } from '@/lib/keyword-audit/dataforseo';
import { normalizeGeoInput } from '@/lib/keyword-audit/geo';
import {
  normalizeCompetitorUrls,
  runCompetitorCompare,
  scrapeSingleCompetitorSlot,
  type RunCompetitorCompareInput,
} from '@/lib/run-competitor-compare';
import {
  scrapePageDataWithFallback,
  scrapePageTextWithFallback,
} from '@/lib/server/puppeteer-scraper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SingleScrapeRequest = {
  url: string;
  maxChars?: number;
};

function isCompareRequest(body: unknown): body is RunCompetitorCompareInput {
  return (
    typeof body === 'object' &&
    body !== null &&
    'yourUrl' in body &&
    'competitorUrls' in body &&
    Array.isArray((body as RunCompetitorCompareInput).competitorUrls)
  );
}

function isSingleScrapeRequest(body: unknown): body is SingleScrapeRequest {
  return typeof body === 'object' && body !== null && typeof (body as SingleScrapeRequest).url === 'string';
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (isCompareRequest(body)) {
    try {
      const competitorUrls = normalizeCompetitorUrls(body.competitorUrls);
      const competitors: ComparePageMetrics[] = [];

      for (let index = 0; index < competitorUrls.length; index++) {
        const url = competitorUrls[index];
        competitors.push(
          await scrapeSingleCompetitorSlot(url, index, scrapePageDataWithFallback)
        );
      }

      const alignedCompetitors = ensureCompetitorSlotIntegrity(competitors, competitorUrls);
      const result = await runCompetitorCompare(
        body,
        scrapePageDataWithFallback,
        alignedCompetitors
      );
      const normalized = {
        ...result,
        competitors: ensureCompetitorSlotIntegrity(result.competitors, competitorUrls),
      };

      const keyword = body.targetKeyword?.trim();
      const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';

      if (keyword && workspaceId) {
        const metricsGeo = normalizeGeoInput({
          country: body.country,
          city: body.city,
          language: body.language,
          device: body.device,
        });

        const seoMetrics = await fetchKeywordAuditSeoMetrics(keyword, metricsGeo, {
          workspaceId,
        });

        if (seoMetrics) {
          normalized.searchVolume = seoMetrics.searchVolume;
          normalized.keywordDifficulty = seoMetrics.keywordDifficulty;
          normalized.metricsGeo = metricsGeo;
        }
      }

      return NextResponse.json(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Competitor compare failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!isSingleScrapeRequest(body)) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const { url, maxChars } = body;

  try {
    validateHttpUrl(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (typeof maxChars === 'number') {
      const text = await scrapePageTextWithFallback(url, maxChars);
      return NextResponse.json({ text });
    }

    const data = await scrapePageDataWithFallback(url);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scrape failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function validateHttpUrl(url: string): void {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`URL must use http or https: ${url}`);
  }
}

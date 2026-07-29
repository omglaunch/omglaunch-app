import type { TrustSignals } from '@/lib/competitor-compare-data';
import { countWords, normalizeWhitespace, sanitizeBodyText } from '@/lib/scrape-content';

export type ScrapeMethod = 'browser' | 'cheerio';

export type ScrapePageData = {
  url: string;
  title: string;
  headings: string[];
  wordCount: number;
  bodyText: string;
  images: {
    total: number;
    missingAlt: number;
    backgroundImages?: number;
  };
  trustSignals: TrustSignals;
  schemaTypes: string[];
  scrapeMethod: ScrapeMethod;
};

export { countWords, normalizeWhitespace, sanitizeBodyText };

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  if (process.env.URL) {
    return process.env.URL.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const port = process.env.PORT ?? '3000';
  return `http://127.0.0.1:${port}`;
}

async function postScrapeApi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${getAppBaseUrl()}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Scrape request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function scrapePageData(url: string): Promise<ScrapePageData> {
  return postScrapeApi<ScrapePageData>({ url });
}

export async function scrapePageText(url: string, maxChars = 8000): Promise<string> {
  const payload = await postScrapeApi<{ text: string }>({ url, maxChars });
  return payload.text;
}

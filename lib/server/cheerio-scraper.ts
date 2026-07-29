import { load, type Cheerio, type CheerioAPI } from 'cheerio/slim';
import type { Element } from 'domhandler';
import type { ScrapePageData } from '@/lib/scraper';
import { parseSchemaTypesFromJsonLdBlocks } from '@/lib/competitor-compare-metrics';
import { countWords } from '@/lib/scrape-content';
import {
  countContentImagesCheerio,
  extractTrustSignalsCheerio,
} from '@/lib/scrape-trust-signals';
import {
  removeHiddenContentFromCheerio,
} from '@/lib/scrape-visible-content';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_TIMEOUT_MS = 45_000;

const TAG_CLUTTER_SELECTORS = [
  'header',
  'footer',
  'nav',
  'aside',
  'script',
  'style',
  'noscript',
  'iframe',
];

const CLUTTER_KEYWORDS = ['menu', 'nav', 'footer', 'sidebar', 'modal'];

function removeClutter($: CheerioAPI, root: Cheerio<Element>): void {
  TAG_CLUTTER_SELECTORS.forEach(selector => {
    root.find(selector).remove();
  });

  root.find('*').each((_, element) => {
    const $element = $(element);

    // Never strip keyword-matched chrome markers from inside primary content.
    if ($element.closest('main, article, #content').length > 0) {
      return;
    }

    const className = ($element.attr('class') ?? '').toLowerCase();
    const id = ($element.attr('id') ?? '').toLowerCase();

    if (CLUTTER_KEYWORDS.some(keyword => className.includes(keyword) || id.includes(keyword))) {
      $element.remove();
    }
  });
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function resolveContentRoot($: CheerioAPI, body: Cheerio<Element>): Cheerio<Element> {
  if (body.find('main').first().length > 0) {
    return body.find('main').first();
  }

  if (body.find('article').first().length > 0) {
    return body.find('article').first();
  }

  if (body.find('#content').first().length > 0) {
    return body.find('#content').first();
  }

  return body;
}

export async function scrapePageDataWithCheerio(url: string): Promise<ScrapePageData> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Cheerio fetch failed (${response.status})`);
  }

  const html = await response.text();
  const $ = load(html);
  const title = normalizeText($('title').first().text());

  const schemaBlocks: string[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html()?.trim();
    if (raw) {
      schemaBlocks.push(raw);
    }
  });
  const schemaTypes = parseSchemaTypesFromJsonLdBlocks(schemaBlocks);

  const body = $('body');
  if (body.length === 0) {
    throw new Error('Cheerio fetch returned no body content');
  }

  removeClutter($, body);

  const contentRoot = resolveContentRoot($, body);
  removeHiddenContentFromCheerio($, contentRoot);
  const bodyText = normalizeText(contentRoot.text());
  const wordCount = countWords(bodyText);

  const headings: string[] = [];
  contentRoot.find('h1, h2').each((_, heading) => {
    const text = normalizeText($(heading).text());
    if (text) {
      headings.push(text);
    }
  });

  const imageCounts = countContentImagesCheerio($, contentRoot);
  const trustSignals = extractTrustSignalsCheerio($, url, contentRoot, bodyText);

  const hasContent =
    Boolean(title) || Boolean(bodyText) || headings.length > 0 || imageCounts.total > 0;

  if (!hasContent) {
    throw new Error('Cheerio fetch returned no readable content');
  }

  return {
    url,
    title,
    headings,
    wordCount,
    bodyText,
    images: {
      total: imageCounts.total,
      missingAlt: imageCounts.missingAlt,
      backgroundImages: imageCounts.backgroundImages,
    },
    trustSignals,
    schemaTypes,
    scrapeMethod: 'cheerio',
  };
}

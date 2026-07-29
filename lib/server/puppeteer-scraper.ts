import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerCore, { type Browser } from 'puppeteer-core';
import type { ScrapePageData } from '@/lib/scraper';
import { countWords, type BrowserScrapePayload } from '@/lib/scrape-content';
import { TRUST_SIGNAL_BROWSER_HELPERS } from '@/lib/scrape-trust-signals';

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_TIMEOUT_MS = 45_000;
const SPA_RENDER_WAIT_MS = 2_000;
const NAVIGATION_WAIT_UNTIL = 'networkidle2' as const;

declare function __poCountContentImages(contentRoot: Element): {
  total: number;
  missingAlt: number;
  backgroundImages: number;
};

declare function __poExtractTrustSignals(
  pageUrl: string,
  contentRoot: Element,
  bodyText: string
): {
  outboundLinks: number;
  quotes: number;
  statistics: number;
};

/** Runs inside Puppeteer — must remain self-contained with no external references. */
function scrapePagePayloadInBrowser(pageUrl: string, trustHelperScript: string): BrowserScrapePayload {
  // Injected shared trust/image helpers (see lib/scrape-trust-signals.ts).
  // eslint-disable-next-line no-eval
  eval(trustHelperScript);
  const schemaTypes: string[] = [];
  const schemaTypeSet = new Set<string>();

  function normalizeSchemaType(type: unknown): string | null {
    if (typeof type !== 'string' || !type.trim()) {
      return null;
    }
    return type.replace(/^https?:\/\/schema\.org\//i, '').trim();
  }

  function collectSchemaTypes(value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(item => collectSchemaTypes(item));
      return;
    }

    const record = value as Record<string, unknown>;
    const typeValue = record['@type'];

    if (typeof typeValue === 'string') {
      const normalized = normalizeSchemaType(typeValue);
      if (normalized) {
        schemaTypeSet.add(normalized);
      }
    } else if (Array.isArray(typeValue)) {
      typeValue.forEach(entry => {
        const normalized = normalizeSchemaType(entry);
        if (normalized) {
          schemaTypeSet.add(normalized);
        }
      });
    }

    if (Array.isArray(record['@graph'])) {
      collectSchemaTypes(record['@graph']);
    }
  }

  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    const raw = script.textContent?.trim();
    if (!raw) {
      return;
    }

    try {
      collectSchemaTypes(JSON.parse(raw));
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  schemaTypes.push(...Array.from(schemaTypeSet).sort());

  const tagClutterSelectors = [
    'header',
    'footer',
    'nav',
    'aside',
    'script',
    'style',
    'noscript',
    'iframe',
  ];

  tagClutterSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      if (element.closest('main, article, #content')) {
        return;
      }
      element.remove();
    });
  });

  const keywordClutter = ['menu', 'nav', 'footer', 'sidebar', 'modal'];
  document.querySelectorAll('*').forEach(element => {
    if (element.closest('main, article, #content')) {
      return;
    }

    const cls = (element.className?.toString?.() ?? String(element.className ?? '')).toLowerCase();
    const id = (element.id ?? '').toLowerCase();
    if (keywordClutter.some(keyword => cls.includes(keyword) || id.includes(keyword))) {
      element.remove();
    }
  });

  const contentRoot =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.querySelector('#content') ||
    document.body;

  if (!contentRoot) {
    return {
      url: pageUrl,
      title: document.title.replace(/\s+/g, ' ').trim(),
      headings: [],
      bodyText: '',
      wordCount: 0,
      images: { total: 0, missingAlt: 0, backgroundImages: 0 },
      trustSignals: { outboundLinks: 0, quotes: 0, statistics: 0 },
      schemaTypes,
    };
  }

  contentRoot
    .querySelectorAll('[aria-hidden="true"], .hidden-html, [hidden], .sr-only, .screen-reader-text')
    .forEach(element => {
      element.remove();
    });

  contentRoot.querySelectorAll<HTMLElement>('[style]').forEach(element => {
    const style = element.getAttribute('style') ?? '';
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) {
      element.remove();
    }
  });

  const bodyText = (contentRoot as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const wordCount = bodyText
    ? bodyText.split(/\s+/).filter(word => word.length > 0).length
    : 0;

  const headings: string[] = [];
  contentRoot.querySelectorAll('h1, h2').forEach(heading => {
    const text = (heading as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
    if (text) {
      headings.push(text);
    }
  });

  const images = __poCountContentImages(contentRoot);

  const trustSignals = __poExtractTrustSignals(pageUrl, contentRoot, bodyText);

  return {
    url: pageUrl,
    title: document.title.replace(/\s+/g, ' ').trim(),
    headings,
    bodyText,
    wordCount,
    images: {
      total: images.total,
      missingAlt: images.missingAlt,
      backgroundImages: images.backgroundImages,
    },
    trustSignals,
    schemaTypes,
  };
}

function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY ||
      process.env.AWS_EXECUTION_ENV
  );
}

async function resolveExecutablePath(): Promise<string> {
  if (isServerlessEnvironment()) {
    return chromium.executablePath();
  }

  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_PATH;
  if (configuredPath) {
    return configuredPath;
  }

  const localCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  const fs = await import('node:fs/promises');
  for (const candidate of localCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try next candidate
    }
  }

  return chromium.executablePath();
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = await resolveExecutablePath();
  const serverless = isServerlessEnvironment();

  return puppeteer.launch({
    args: serverless
      ? chromium.args
      : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1365, height: 900 },
    executablePath,
    headless: true,
  });
}

async function closeBrowserSafely(browser: Browser | null | undefined): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    await browser.close();
  } catch {
    // Browser may already be disconnected after a failed navigation.
  }
}

function waitForSpaRender(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, SPA_RENDER_WAIT_MS));
}

function mapBrowserPayload(url: string, payload: BrowserScrapePayload): ScrapePageData {
  const bodyText = payload.bodyText.trim();
  const wordCount = payload.wordCount || countWords(bodyText);

  return {
    url,
    title: payload.title,
    headings: payload.headings,
    wordCount,
    bodyText,
    images: payload.images,
    trustSignals: payload.trustSignals,
    schemaTypes: payload.schemaTypes ?? [],
    scrapeMethod: 'browser',
  };
}

function isEmptyScrapeResult(data: ScrapePageData): boolean {
  const hasText =
    Boolean(data.bodyText.trim()) || data.wordCount > 0 || data.headings.length > 0;
  const hasImages = data.images.total > 0;

  return !hasText && !hasImages;
}

async function scrapePageDataWithCheerioFallback(url: string, reason: string): Promise<ScrapePageData> {
  console.info(`[scrape] Attempting Cheerio fallback for ${url} (${reason})`);
  const { scrapePageDataWithCheerio } = await import('@/lib/server/cheerio-scraper');
  return scrapePageDataWithCheerio(url);
}

export async function scrapePageDataWithBrowser(url: string): Promise<ScrapePageData> {
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    await page.goto(url, {
      waitUntil: NAVIGATION_WAIT_UNTIL,
      timeout: PAGE_TIMEOUT_MS,
    });
    await waitForSpaRender();

    const payload = await page.evaluate(scrapePagePayloadInBrowser, url, TRUST_SIGNAL_BROWSER_HELPERS);

    return mapBrowserPayload(url, payload);
  } finally {
    await closeBrowserSafely(browser);
  }
}

export async function scrapePageDataWithFallback(url: string): Promise<ScrapePageData> {
  try {
    const browserResult = await scrapePageDataWithBrowser(url);
    if (!isEmptyScrapeResult(browserResult)) {
      return browserResult;
    }

    console.warn(
      `[scrape] Puppeteer returned empty content for ${url}; falling back to Cheerio`
    );
    return await scrapePageDataWithCheerioFallback(url, 'empty puppeteer result');
  } catch (error) {
    console.warn(
      `[scrape] Puppeteer failed for ${url}:`,
      error instanceof Error ? error.message : error
    );

    try {
      return await scrapePageDataWithCheerioFallback(url, 'puppeteer error');
    } catch (fallbackError) {
      console.error(
        `[scrape] Cheerio fallback failed for ${url}:`,
        fallbackError instanceof Error ? fallbackError.message : fallbackError
      );
      throw fallbackError;
    }
  }
}

export async function scrapePageTextWithBrowser(url: string, maxChars = 8000): Promise<string> {
  const scraped = await scrapePageDataWithBrowser(url);
  const combined = [scraped.title, scraped.headings.join('\n'), scraped.bodyText]
    .filter(Boolean)
    .join('\n\n');

  return combined.slice(0, maxChars);
}

export async function scrapePageTextWithFallback(url: string, maxChars = 8000): Promise<string> {
  const scraped = await scrapePageDataWithFallback(url);
  const combined = [scraped.title, scraped.headings.join('\n'), scraped.bodyText]
    .filter(Boolean)
    .join('\n\n');

  return combined.slice(0, maxChars);
}

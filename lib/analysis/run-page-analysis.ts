import * as cheerio from 'cheerio';
import type { AnalysisCheck, AnalysisMetrics } from '@/lib/analysis-data';
import { generateAnalysisExecutiveSummary } from '@/lib/ai';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CHECK_DEFINITIONS: Pick<AnalysisCheck, 'question' | 'category'>[] = [
  { question: 'Is the page well structured?', category: 'structure' },
  { question: 'Does the page include descriptive images?', category: 'content' },
  { question: 'Does the page have valid JSON-LD?', category: 'structured-data' },
  { question: 'Is the page well segmented?', category: 'structure' },
  { question: 'Is the content easy to read?', category: 'content' },
  { question: 'Is the markup semantically consistent?', category: 'markup' },
  { question: 'Does the page have a table of contents?', category: 'navigation' },
  { question: 'Does the page offer a concise summary?', category: 'content' },
  { question: 'Does the page load quickly?', category: 'performance' },
  { question: 'Is the content accessible without JavaScript?', category: 'accessibility' },
  { question: 'Is the robots.txt file complete?', category: 'technical' },
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countWords(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 0;
  return normalized.split(' ').length;
}

function extractBodyText($: cheerio.CheerioAPI): string {
  const bodyHtml = $('body').html();
  const html = bodyHtml ?? $.root().html() ?? '';
  const $content = cheerio.load(`<div id="analysis-root">${html}</div>`);
  $content('script, style, noscript').remove();
  return $content('#analysis-root').text().replace(/\s+/g, ' ').trim();
}

function scoreWellStructured($: cheerio.CheerioAPI): number {
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'footer'];
  const present = semanticTags.filter(tag => $(tag).length > 0).length;
  return clampScore((present / semanticTags.length) * 100);
}

function scoreDescriptiveImages($: cheerio.CheerioAPI): number {
  const images = $('img');
  const total = images.length;
  if (total === 0) return 100;

  let withAlt = 0;
  images.each((_, element) => {
    const alt = $(element).attr('alt');
    if (alt !== undefined && alt.trim() !== '') {
      withAlt += 1;
    }
  });

  return clampScore((withAlt / total) * 100);
}

function scoreValidJsonLd($: cheerio.CheerioAPI): number {
  const scripts = $('script[type="application/ld+json"]');
  if (scripts.length === 0) return 0;

  for (let i = 0; i < scripts.length; i++) {
    const content = $(scripts[i]).html()?.trim();
    if (!content) continue;
    try {
      JSON.parse(content);
      return 100;
    } catch {
      // try next block
    }
  }

  return 0;
}

function scoreWellSegmented($: cheerio.CheerioAPI, wordCount: number): number {
  const headingCount = $('h1, h2, h3').length;
  if (wordCount === 0) return 0;
  if (headingCount === 0) return wordCount > 100 ? 20 : 50;

  const wordsPerHeading = wordCount / headingCount;
  if (wordsPerHeading >= 50 && wordsPerHeading <= 400) return 100;
  if (wordsPerHeading < 50) return clampScore(60 + wordsPerHeading);
  if (wordsPerHeading <= 600) return clampScore(100 - ((wordsPerHeading - 400) / 200) * 40);
  return clampScore(60 - ((wordsPerHeading - 600) / 400) * 60);
}

function scoreEasyToRead($: cheerio.CheerioAPI, wordCount: number): number {
  const html = $.root().html() ?? '';
  const text = extractBodyText($);
  const textLength = text.length;
  const htmlLength = html.length || 1;
  const density = textLength / htmlLength;

  const headingCount = Math.max($('h1, h2, h3, h4').length, 1);
  const wordsPerHeading = wordCount / headingCount;

  let densityScore: number;
  if (density >= 0.08) densityScore = 100;
  else if (density >= 0.04) densityScore = clampScore(((density - 0.04) / 0.04) * 100);
  else densityScore = clampScore((density / 0.04) * 60);

  let layoutScore: number;
  if (wordsPerHeading >= 40 && wordsPerHeading <= 350) layoutScore = 100;
  else if (wordsPerHeading < 40) layoutScore = clampScore(50 + wordsPerHeading);
  else layoutScore = clampScore(100 - ((wordsPerHeading - 350) / 250) * 50);

  return clampScore(densityScore * 0.55 + layoutScore * 0.45);
}

function scoreSemanticConsistency($: cheerio.CheerioAPI): number {
  const headings = $('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) return 0;

  let score = 100;
  const hasH1 = $('h1').length > 0;
  if (!hasH1) score -= 35;

  let lastLevel = 0;
  headings.each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const level = Number.parseInt(tag.replace('h', ''), 10);
    if (lastLevel > 0 && level > lastLevel + 1) {
      score -= 20;
    }
    lastLevel = level;
  });

  return clampScore(score);
}

function scoreTableOfContents($: cheerio.CheerioAPI): number {
  const tocSelector =
    '[id*="toc" i], [class*="toc" i], [class*="table-of-contents" i], [id*="table-of-contents" i]';
  if ($(tocSelector).length > 0) return 100;

  const internalLinks = $('a[href^="#"]').filter((_, element) => {
    const href = $(element).attr('href') ?? '';
    return href.length > 1;
  });

  const linkCount = internalLinks.length;
  if (linkCount >= 8) return 100;
  if (linkCount >= 5) return 85;
  if (linkCount >= 3) return 60;
  if (linkCount >= 1) return 35;
  return 0;
}

function extractMetaDescription($: cheerio.CheerioAPI): string {
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ??
    $('meta[property="og:description"]').attr('content')?.trim() ??
    '';
  return metaDescription;
}

function scoreConciseSummary($: cheerio.CheerioAPI): number {
  const description = extractMetaDescription($);
  if (!description) return 0;
  if (description.length >= 50 && description.length <= 160) return 100;
  if (description.length >= 25) return 75;
  return 40;
}

function scoreLoadTime(fetchMs: number): number {
  if (fetchMs < 500) return 100;
  if (fetchMs >= 3000) return 0;
  return clampScore(100 - ((fetchMs - 500) / 2500) * 100);
}

function scoreAccessibleWithoutJs(wordCount: number): number {
  if (wordCount >= 100) return 100;
  if (wordCount >= 50) return 80;
  if (wordCount >= 20) return 55;
  if (wordCount > 0) return 30;
  return 0;
}

async function fetchRobotsTxtScore(pageUrl: string): Promise<number> {
  try {
    const robotsUrl = new URL('/robots.txt', pageUrl).href;
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    if (!response.ok) return 0;

    const text = await response.text();
    const hasUserAgent = /user-agent\s*:/i.test(text);
    return hasUserAgent ? 100 : 0;
  } catch {
    return 0;
  }
}

function computeChecks(
  $: cheerio.CheerioAPI,
  wordCount: number,
  fetchMs: number,
  robotsScore: number
): AnalysisCheck[] {
  const scores: Record<string, number> = {
    'Is the page well structured?': scoreWellStructured($),
    'Does the page include descriptive images?': scoreDescriptiveImages($),
    'Does the page have valid JSON-LD?': scoreValidJsonLd($),
    'Is the page well segmented?': scoreWellSegmented($, wordCount),
    'Is the content easy to read?': scoreEasyToRead($, wordCount),
    'Is the markup semantically consistent?': scoreSemanticConsistency($),
    'Does the page have a table of contents?': scoreTableOfContents($),
    'Does the page offer a concise summary?': scoreConciseSummary($),
    'Does the page load quickly?': scoreLoadTime(fetchMs),
    'Is the content accessible without JavaScript?': scoreAccessibleWithoutJs(wordCount),
    'Is the robots.txt file complete?': robotsScore,
  };

  return CHECK_DEFINITIONS.map(({ question, category }) => ({
    question,
    category,
    score: scores[question] ?? 0,
  }));
}

export async function runPageAnalysis(url: string): Promise<AnalysisMetrics> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error('URL is required');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('URL must use http or https');
  }

  const fetchStarted = Date.now();
  const pageResponse = await fetch(parsedUrl.href, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  const fetchMs = Date.now() - fetchStarted;

  if (!pageResponse.ok) {
    throw new Error(
      `Failed to fetch ${parsedUrl.href}: ${pageResponse.status} ${pageResponse.statusText}`
    );
  }

  const [html, robotsScore] = await Promise.all([
    pageResponse.text(),
    fetchRobotsTxtScore(parsedUrl.href),
  ]);

  const $ = cheerio.load(html);
  const wordCount = countWords(extractBodyText($));
  const metaDescription = extractMetaDescription($);
  const checks = computeChecks($, wordCount, fetchMs, robotsScore);

  const executiveSummary = await generateAnalysisExecutiveSummary(
    parsedUrl.href,
    metaDescription,
    checks
  );

  return {
    url: parsedUrl.href,
    overallScore: executiveSummary.overallScore,
    summaryText: executiveSummary.summaryText,
    checks,
  };
}

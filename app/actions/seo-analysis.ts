'use server';

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type {
  KeywordFrequency,
  SeoAnalysisMetrics,
  SeoCriterion,
  SeoCriterionStatus,
} from '@/lib/seo-analysis-data';
import type {
  SemanticAnalysisResult,
  SemanticCriterion,
} from '@/lib/semantic-metrics';
import { DEFAULT_SEMANTIC_LOCATION_CODE } from '@/lib/analysis-state';
import {
  computeExpressionBenchmark,
  computeSemanticScore,
  deriveFallbackIdealOccurrence,
  deriveIdealOccurrenceFromDensity,
  filterWordCountOutliers,
  type CompetitorPageSnapshot,
} from '@/lib/semantic-scoring';

const DATAFORSEO_SERP_ORGANIC_URL =
  'https://api.dataforseo.com/v3/serp/google/organic/live/regular';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'your',
  'our',
  'their',
  'my',
  'his',
  'her',
  'its',
  'into',
  'about',
  'over',
  'after',
  'before',
  'between',
  'through',
  'during',
  'without',
  'within',
  'along',
  'while',
  'best',
  'top',
  'new',
  'get',
  'how',
  'guide',
  'complete',
]);

const NON_SCORING_CRITERION_IDS = new Set(['distinct-relevant-words', 'search-volume']);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UI_BOILERPLATE_PHRASES = [
  'add to cart',
  'add to bag',
  'add to basket',
  'buy now',
  'shop now',
  'customer favorites',
  'customer favourites',
  'customer favorite',
  'customer favourite',
  'free shipping',
  'sign in',
  'sign up',
  'view cart',
  'your cart',
  'checkout',
  'add to wishlist',
  'out of stock',
  'in stock',
  'limited time offer',
  'sale ends',
  'read more',
  'learn more',
  'click here',
];

function isStandaloneNumberToken(word: string): boolean {
  return /^\d+$/.test(word);
}

function sanitizeSemanticText(text: string): string {
  let cleaned = text.replace(/<[^>]*>/g, ' ');

  cleaned = cleaned.replace(
    /\b(?:price\s*)?(?:rm|myr|usd|sgd|idr|thb|php|vnd|\$|€|£)\s*\d+(?:[.,]\d{2})?\b/gi,
    ' '
  );
  cleaned = cleaned.replace(/\b(?:rm|myr|usd|sgd)\d+(?:\s+\d{2})?\b/gi, ' ');
  cleaned = cleaned.replace(/\bpricerm\d+\b/gi, ' ');
  cleaned = cleaned.replace(/\bprice\s*(?:rm|myr|usd)?\s*\d+\b/gi, ' ');

  for (const phrase of UI_BOILERPLATE_PHRASES) {
    cleaned = cleaned.replace(new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi'), ' ');
  }

  cleaned = cleaned.replace(/\breviews?\b/gi, ' ');

  return cleaned.replace(/\s+/g, ' ').trim();
}

function filterSemanticWords(words: string[]): string[] {
  return words.filter(word => word.length > 0 && !isStandaloneNumberToken(word));
}

function scoreContextNoise(snippet: string): number {
  const normalized = normalizeText(snippet);
  if (!normalized) return 1;

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0) return 1;

  let score = 0;
  const standaloneNumbers = words.filter(isStandaloneNumberToken).length;
  score += (standaloneNumbers / words.length) * 0.45;

  for (const phrase of UI_BOILERPLATE_PHRASES) {
    if (normalized.includes(phrase)) {
      score += 0.35;
    }
  }

  if (/\breviews?\b/.test(normalized)) score += 0.2;
  if (/\b(?:price|pricerm|cart|checkout)\b/.test(normalized)) score += 0.25;
  if (words.length < 4) score += 0.15;
  if (words.length > 12) score += 0.1;

  return Math.min(1, score);
}

function cleanContextSnippet(snippet: string): string {
  const sanitized = sanitizeSemanticText(snippet);
  const words = filterSemanticWords(normalizeText(sanitized).split(' ').filter(Boolean));
  return words.join(' ');
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter(word => word.length > 0 && !STOP_WORDS.has(word));
}

function extractNgrams(tokens: string[], size: number): string[] {
  if (tokens.length < size) return [];
  const ngrams: string[] = [];
  for (let index = 0; index <= tokens.length - size; index += 1) {
    ngrams.push(tokens.slice(index, index + size).join(' '));
  }
  return ngrams;
}

function detectPrimaryKeyword(title: string, h1: string): string {
  const titleTokens = tokenize(title);
  const h1Tokens = tokenize(h1);

  for (let size = 4; size >= 2; size -= 1) {
    const titleNgrams = extractNgrams(titleTokens, size);
    const h1NgramSet = new Set(extractNgrams(h1Tokens, size));
    for (const phrase of titleNgrams) {
      if (h1NgramSet.has(phrase)) {
        return phrase;
      }
    }
  }

  const h1Set = new Set(h1Tokens);
  const shared = titleTokens.filter(token => h1Set.has(token));
  if (shared.length >= 2) {
    return shared.slice(0, 4).join(' ');
  }
  if (h1Tokens.length >= 2) {
    return h1Tokens.slice(0, 4).join(' ');
  }
  if (titleTokens.length >= 2) {
    return titleTokens.slice(0, 4).join(' ');
  }

  const fallback = h1.trim() || title.trim();
  return fallback || 'unknown';
}

function countWords(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 0;
  return normalized.split(' ').length;
}

function splitWords(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter(word => word.length > 0);
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(sentence => sentence.replace(/\s+/g, ' ').trim())
    .filter(sentence => sentence.length > 0);
}

function extractBodyText($: cheerio.CheerioAPI): string {
  const bodyHtml = $('body').html();
  const html = bodyHtml ?? $.root().html() ?? '';
  const $content = cheerio.load(`<div id="seo-analysis-root">${html}</div>`);
  $content('script, style, noscript').remove();
  return $content('#seo-analysis-root').text().replace(/\s+/g, ' ').trim();
}

function extractFooterText($: cheerio.CheerioAPI): string {
  const footer = $('footer').first();
  if (footer.length === 0) return '';
  return footer.text().replace(/\s+/g, ' ').trim();
}

function truncateExcerpt(text: string, maxLength = 140): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()} [...]`;
}

function getHeadingText($: cheerio.CheerioAPI, element: Element): string {
  return $(element).text().replace(/\s+/g, ' ').trim();
}

function analyzeHeadingOrder($: cheerio.CheerioAPI): {
  status: SeoCriterionStatus;
  subtext?: string;
} {
  const headings = $('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) {
    return {
      status: 'fail',
      subtext: 'No heading tags were found on the page.',
    };
  }

  let lastLevel = 0;
  let emptyTag: string | null = null;
  let skippedLevel = false;

  headings.each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const level = Number.parseInt(tag.replace('h', ''), 10);
    const text = getHeadingText($, element);

    if (!text) {
      emptyTag = tag;
    }

    if (lastLevel > 0 && level > lastLevel + 1) {
      skippedLevel = true;
    }

    lastLevel = level;
  });

  if (emptyTag) {
    return {
      status: 'fail',
      subtext: `An ${emptyTag} tag is empty. => See the page map to identify any problems with titles`,
    };
  }

  if (skippedLevel) {
    return {
      status: 'warning',
      subtext:
        'Heading levels skip a rank (for example H1 to H3). Keep a logical H1 / Hn hierarchy.',
    };
  }

  if ($('h1').length === 0) {
    return {
      status: 'fail',
      subtext: 'The page has no H1 tag. Add a single, descriptive H1.',
    };
  }

  return { status: 'pass' };
}

function resolveLinkTarget(href: string, pageUrl: URL): URL | null {
  try {
    return new URL(href, pageUrl.href);
  } catch {
    return null;
  }
}

function isInternalLink(linkUrl: URL, pageUrl: URL): boolean {
  return linkUrl.hostname.replace(/^www\./, '') === pageUrl.hostname.replace(/^www\./, '');
}

function countUniqueLinks(
  $: cheerio.CheerioAPI,
  pageUrl: URL
): { internal: number; outbound: number } {
  const internal = new Set<string>();
  const outbound = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    const linkUrl = resolveLinkTarget(href, pageUrl);
    if (!linkUrl) return;

    const normalized = linkUrl.href.split('#')[0];
    if (isInternalLink(linkUrl, pageUrl)) {
      internal.add(normalized);
    } else {
      outbound.add(normalized);
    }
  });

  return { internal: internal.size, outbound: outbound.size };
}

function getRelevantWordStats(
  bodyWords: string[],
  keyword: string,
  topicTokens: Set<string>
): {
  relevantCount: number;
  distinctCount: number;
  distinctPercent: number;
} {
  const keywordTokens = tokenize(keyword);
  const keywordTokenSet = new Set(keywordTokens);

  const relevantWords = bodyWords.filter(word => {
    if (STOP_WORDS.has(word)) return false;
    if (keywordTokenSet.has(word)) return true;
    return topicTokens.has(word);
  });

  const distinctRelevant = new Set(relevantWords);
  const relevantCount = relevantWords.length;
  const distinctCount = distinctRelevant.size;
  const distinctPercent =
    relevantCount > 0 ? Math.round((distinctCount / relevantCount) * 100) : 0;

  return { relevantCount, distinctCount, distinctPercent };
}

function metaTitleLengthStatus(length: number): { status: SeoCriterionStatus; subtext: string } {
  if (length >= 50 && length <= 60) {
    return { status: 'pass', subtext: `${length} characters, that's a good length.` };
  }
  if (length >= 40 && length <= 70) {
    return {
      status: 'warning',
      subtext: `${length} characters. Aim for 50–60 characters for the meta title.`,
    };
  }
  if (length === 0) {
    return { status: 'fail', subtext: 'The page has no meta title.' };
  }
  return {
    status: 'fail',
    subtext: `${length} characters. Meta titles should usually stay between 50 and 60 characters.`,
  };
}

function metaDescriptionStatus(
  description: string
): { status: SeoCriterionStatus; subtext: string } {
  const length = description.length;
  const wordCount = countWords(description);

  if (length >= 110 && length <= 170) {
    return {
      status: 'pass',
      subtext: `${length} characters for ${wordCount} words in the tag, that's a good length (between 110 and 170 characters).`,
    };
  }
  if (length === 0) {
    return { status: 'fail', subtext: 'The page has no meta description tag.' };
  }
  if (length >= 70 && length < 110) {
    return {
      status: 'warning',
      subtext: `${length} characters. Consider expanding to 110–170 characters.`,
    };
  }
  if (length > 170 && length <= 200) {
    return {
      status: 'warning',
      subtext: `${length} characters. Meta descriptions over 170 characters may be truncated.`,
    };
  }
  return {
    status: 'fail',
    subtext: `${length} characters. Meta descriptions should usually stay between 110 and 170 characters.`,
  };
}

function extractContentWords(bodyText: string): string[] {
  const sanitized = sanitizeSemanticText(bodyText);
  return normalizeText(sanitized)
    .split(' ')
    .filter(word => word.length > 0 && !STOP_WORDS.has(word) && !isStandaloneNumberToken(word));
}

function computeKeywordFrequencies(bodyText: string): KeywordFrequency[] {
  const words = extractContentWords(bodyText);
  if (words.length === 0) {
    return [];
  }

  const frequencyMap = new Map<string, number>();
  for (const word of words) {
    frequencyMap.set(word, (frequencyMap.get(word) ?? 0) + 1);
  }

  const rankedWords = Array.from(frequencyMap.entries()).sort((a, b) => b[1] - a[1]);
  const topWords = rankedWords.slice(0, 15);

  return topWords.map(([text, value]) => ({ text, value }));
}

function computeOverallScore(criteria: SeoCriterion[]): number {
  const scoringCriteria = criteria.filter(
    criterion => !NON_SCORING_CRITERION_IDS.has(criterion.id)
  );

  if (scoringCriteria.length === 0) return 0;

  const points = scoringCriteria.reduce((sum, criterion) => {
    if (criterion.status === 'pass') return sum + 1;
    if (criterion.status === 'warning') return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((points / scoringCriteria.length) * 1000) / 10;
}

function buildCriteria(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  html: string,
  resolvedKeyword: string,
  keywordAutoDetected: boolean
): SeoCriterion[] {
  const metaTitle = $('title').first().text().replace(/\s+/g, ' ').trim();
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ??
    $('meta[property="og:description"]').attr('content')?.trim() ??
    '';
  const canonical =
    $('link[rel="canonical"]').attr('href')?.trim() ??
    $('link[rel="canonical" i]').attr('href')?.trim() ??
    '';
  const robotsContent = $('meta[name="robots"]').attr('content')?.trim() ?? '';
  const langCode =
    $('html').attr('lang')?.trim().toLowerCase() ??
    $('meta[http-equiv="content-language"]').attr('content')?.trim().toLowerCase() ??
    '';

  const h1Elements = $('h1');
  const h1Texts = h1Elements
    .map((_, element) => getHeadingText($, element))
    .get()
    .filter(Boolean);
  const mainH1 = h1Texts[0] ?? '';
  const h1Count = h1Elements.length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const strongCount = $('strong, b').length;
  const images = $('img');
  const imageCount = images.length;
  let imagesWithoutAlt = 0;
  images.each((_, element) => {
    const alt = $(element).attr('alt');
    if (alt === undefined || alt.trim() === '') {
      imagesWithoutAlt += 1;
    }
  });

  const bodyText = extractBodyText($);
  const bodyWords = splitWords(bodyText);
  const totalWords = bodyWords.length;
  const topicTokens = new Set([...tokenize(metaTitle), ...tokenize(mainH1)]);
  const { relevantCount, distinctCount, distinctPercent } = getRelevantWordStats(
    bodyWords,
    resolvedKeyword,
    topicTokens
  );
  const relevantPercent =
    totalWords > 0 ? Math.round((relevantCount / totalWords) * 100) : 0;

  const sentences = splitSentences(bodyText);
  const totalSentences = sentences.length;
  const sentencesOverFourWords = sentences.filter(sentence => countWords(sentence) > 4).length;
  const sentencesOverFourPercent =
    totalSentences > 0 ? Math.round((sentencesOverFourWords / totalSentences) * 100) : 0;

  const textLength = bodyText.length;
  const htmlLength = html.length || 1;
  const textCodeRatio = Math.round((textLength / htmlLength) * 10000) / 100;

  const { internal: internalLinks, outbound: outboundLinks } = countUniqueLinks($, pageUrl);
  const headingOrder = analyzeHeadingOrder($);
  const footerText = extractFooterText($);
  const footerWordCount = countWords(footerText);

  const hasOpenGraph =
    $('meta[property^="og:"]').length > 0 ||
    Boolean($('meta[property="og:title"]').attr('content'));
  const hasTwitter =
    $('meta[name^="twitter:"]').length > 0 ||
    $('meta[property^="twitter:"]').length > 0;

  const urlWords = pageUrl.pathname
    .split('/')
    .filter(Boolean)
    .join(' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const metaTitleDifferent =
    normalizeText(metaTitle) !== normalizeText(mainH1) && Boolean(metaTitle && mainH1);

  const robotsNormalized = robotsContent.toLowerCase().replace(/\s+/g, '');
  const robotsHasDefaultIndexFollow =
    robotsNormalized.includes('index') && robotsNormalized.includes('follow');

  const titleLengthStatus = metaTitleLengthStatus(metaTitle.length);
  const descriptionStatus = metaDescriptionStatus(metaDescription);

  return [
    {
      id: 'language-code',
      label: 'language code chosen',
      value: langCode || '(not set)',
      status: langCode ? 'pass' : 'warning',
      subtext: langCode
        ? undefined
        : 'No language code was found on the html element.',
    },
    {
      id: 'target-keyword',
      label: 'keyword you think the page is targeting',
      value: resolvedKeyword,
      status: resolvedKeyword && resolvedKeyword !== 'unknown' ? 'pass' : 'warning',
      subtext: keywordAutoDetected
        ? 'This keyword was automatically extracted from the page title and H1.'
        : undefined,
    },
    {
      id: 'search-volume',
      label: 'search volume for target keyword',
      value: 'Not available in this analysis',
      status: 'warning',
      subtext:
        'Search volume requires a keyword research API integration and is not computed from the page HTML.',
    },
    {
      id: 'robots-tag',
      label: 'content of the robots tag',
      value: robotsContent || '(no robots meta tag)',
      status: robotsContent
        ? robotsHasDefaultIndexFollow
          ? 'warning'
          : 'pass'
        : 'pass',
      subtext: robotsContent
        ? robotsHasDefaultIndexFollow
          ? 'It is not necessary to indicate "index,follow" in the robots tag, because it is its default value.'
          : undefined
        : 'No robots meta tag was found; default index,follow behaviour applies.',
    },
    {
      id: 'url-words',
      label: 'words in the URL',
      value: urlWords || '(no path segments)',
      status: urlWords.split(' ').filter(Boolean).length >= 2 ? 'pass' : 'warning',
      subtext:
        urlWords.split(' ').filter(Boolean).length >= 2
          ? undefined
          : 'The URL path contains very few descriptive words.',
    },
    {
      id: 'meta-title',
      label: 'balise "meta title"',
      value: metaTitle || '(missing)',
      status: titleLengthStatus.status,
      subtext: titleLengthStatus.subtext,
    },
    {
      id: 'meta-description',
      label: 'meta description tag',
      value: metaDescription || '(missing)',
      status: descriptionStatus.status,
      subtext: descriptionStatus.subtext,
    },
    {
      id: 'canonical-tag',
      label: 'canonical tag',
      value: canonical || '(missing)',
      status: canonical ? 'pass' : 'warning',
      subtext: canonical ? undefined : 'No canonical link tag was found on the page.',
    },
    {
      id: 'main-h1',
      label: 'main title (H1 tag)',
      value: mainH1 || '(missing)',
      status: mainH1 ? 'pass' : 'fail',
      subtext: mainH1 ? undefined : 'The page has no visible H1 heading.',
    },
    {
      id: 'single-h1',
      label: 'a single H1 tag',
      value:
        h1Count === 1
          ? 'Yes, the page has a single H1 tag'
          : h1Count === 0
            ? 'No H1 tag found'
            : `No, the page has ${h1Count} H1 tags`,
      status: h1Count === 1 ? 'pass' : 'fail',
      subtext:
        h1Count === 1
          ? undefined
          : h1Count === 0
            ? 'Every page should have exactly one H1 tag.'
            : 'Use exactly one H1 tag per page.',
    },
    {
      id: 'hn-order',
      label: 'respect of the order of the H1 / Hn tags',
      value: headingOrder.status === 'pass' ? 'Heading hierarchy is valid' : '',
      status: headingOrder.status,
      subtext: headingOrder.subtext,
    },
    {
      id: 'h2-count',
      label: 'number of H2 tags (level 2 subheadings)',
      value: h2Count,
      status: h2Count >= 1 && h2Count <= 25 ? 'pass' : h2Count === 0 ? 'warning' : 'warning',
      subtext:
        h2Count === 0
          ? 'The page has no H2 subheadings. Use H2 tags to structure long content.'
          : h2Count > 25
            ? `There are ${h2Count} H2 tags. Consider consolidating sections if the page feels fragmented.`
            : undefined,
    },
    {
      id: 'h3-count',
      label: 'number of H3 tags (level 3 subtitles)',
      value: h3Count,
      status: h3Count <= 30 ? 'pass' : 'warning',
      subtext:
        h3Count > 30
          ? 'There are too many H3 tags on the page. Do not exceed 30 H3 tags.'
          : undefined,
    },
    {
      id: 'strong-count',
      label: 'number of strong tags',
      value: strongCount,
      status: strongCount <= 50 ? 'pass' : strongCount <= 150 ? 'warning' : 'fail',
      subtext:
        strongCount > 150
          ? "There are too many strong tags on the page, so don't overuse them."
          : strongCount > 50
            ? 'Strong tags are used frequently. Reserve emphasis for truly important phrases.'
            : undefined,
    },
    {
      id: 'meta-title-h1-diff',
      label: 'different "meta title" and H1 tags',
      value: metaTitleDifferent
        ? 'Yes, the tags are different'
        : metaTitle && mainH1
          ? 'No, the tags are identical or very similar'
          : '(unable to compare)',
      status: metaTitleDifferent ? 'pass' : metaTitle && mainH1 ? 'warning' : 'fail',
      subtext: metaTitleDifferent
        ? undefined
        : metaTitle && mainH1
          ? 'The meta title and H1 are identical. Slight variation can improve click-through rate while keeping intent aligned.'
          : 'Both a meta title and an H1 are required for comparison.',
    },
    {
      id: 'text-code-ratio',
      label: 'ratio text / code',
      value: `${textCodeRatio}%`,
      status: textCodeRatio >= 12 ? 'pass' : textCodeRatio >= 8 ? 'warning' : 'fail',
      subtext:
        textCodeRatio < 12
          ? "The ratio of text to code on the page is a little low (but don't focus on that)."
          : undefined,
    },
    {
      id: 'total-words',
      label: 'total words',
      value: totalWords,
      status: totalWords >= 300 ? 'pass' : totalWords >= 150 ? 'warning' : 'fail',
      subtext:
        totalWords < 300
          ? totalWords < 150
            ? 'The page has very little textual content.'
            : 'The page is relatively short. Long-form content often performs better for competitive queries.'
          : undefined,
    },
    {
      id: 'relevant-words',
      label: 'relevant words',
      value: `${relevantCount} (${relevantPercent}%)`,
      status: relevantPercent >= 50 ? 'pass' : relevantPercent >= 30 ? 'warning' : 'fail',
      subtext:
        relevantPercent < 50
          ? 'A lower share of words match the target keyword and topic vocabulary.'
          : undefined,
    },
    {
      id: 'distinct-relevant-words',
      label: 'distinct relevant words',
      value: `${distinctCount} (${distinctPercent}%)`,
      status: distinctPercent >= 30 ? 'pass' : 'fail',
      subtext:
        distinctPercent < 30
          ? 'The percentage of distinct relevant words is too low. This criterion does not count in the SEO score.'
          : undefined,
    },
    {
      id: 'total-sentences',
      label: 'total sentences',
      value: totalSentences,
      status: totalSentences >= 20 ? 'pass' : 'warning',
      subtext:
        totalSentences < 20 ? 'The page contains very few sentences.' : undefined,
    },
    {
      id: 'sentences-over-4-words',
      label: 'sentences of more than 4 words',
      value: `${sentencesOverFourWords} (${sentencesOverFourPercent}%)`,
      status: sentencesOverFourPercent >= 75 ? 'pass' : 'warning',
      subtext:
        sentencesOverFourPercent < 75
          ? 'Many sentences are very short. Longer sentences can improve readability balance.'
          : undefined,
    },
    {
      id: 'internal-links',
      label: 'number of unique internal links',
      value: internalLinks,
      status: internalLinks >= 3 ? 'pass' : internalLinks >= 1 ? 'warning' : 'fail',
      subtext:
        internalLinks < 3
          ? 'Add more internal links to related pages on your site.'
          : undefined,
    },
    {
      id: 'outbound-links',
      label: 'number of unique outbound links',
      value: outboundLinks,
      status:
        outboundLinks >= 3 && outboundLinks <= 15
          ? 'pass'
          : outboundLinks === 0
            ? 'warning'
            : 'warning',
      subtext:
        outboundLinks > 15
          ? 'The number of outbound links on this page is too high. Try adding between 3 and 15 outbound links.'
          : outboundLinks < 3
            ? 'Consider adding a few authoritative outbound links (between 3 and 15).'
            : undefined,
    },
    {
      id: 'image-count',
      label: 'number of images',
      value: imageCount,
      status: imageCount >= 1 ? 'pass' : 'warning',
      subtext: imageCount === 0 ? 'The page contains no images.' : undefined,
    },
    {
      id: 'images-without-alt',
      label: 'number of images without alt attribute',
      value: imagesWithoutAlt,
      status: imagesWithoutAlt === 0 ? 'pass' : imagesWithoutAlt <= 2 ? 'warning' : 'fail',
      subtext:
        imagesWithoutAlt > 0
          ? `There ${imagesWithoutAlt === 1 ? 'is' : 'are'} ${imagesWithoutAlt} image${imagesWithoutAlt === 1 ? '' : 's'} without alt attribute, it is not blocking, but it is better to always describe the images with alt attribute.`
          : undefined,
    },
    {
      id: 'open-graph',
      label: 'balises open graph',
      value: hasOpenGraph ? 'Open graph tags are present.' : 'No open graph tags found.',
      status: hasOpenGraph ? 'pass' : 'warning',
      subtext: hasOpenGraph ? undefined : 'Add og:title and og:description for richer social previews.',
    },
    {
      id: 'twitter-tags',
      label: 'balises twitter',
      value: hasTwitter
        ? 'Twitter card tags are present.'
        : 'No twitter tag on the page (not a problem, considering the interest of Twitter...)',
      status: hasTwitter ? 'pass' : 'warning',
    },
    {
      id: 'footer-text',
      label: 'text in footer',
      value: footerText
        ? `Extrait : ${truncateExcerpt(footerText)}`
        : '(no footer element found)',
      status: footerWordCount <= 100 ? 'pass' : footerWordCount <= 200 ? 'warning' : 'fail',
      subtext:
        footerWordCount > 100
          ? `Your footer contains ${footerWordCount} words. Footer text dilutes the content; use the footer sparingly, for legal information, copyrights or contact links.`
          : undefined,
    },
  ];
}

export async function runFullSeoAnalysis(
  url: string,
  targetKeyword?: string
): Promise<SeoAnalysisMetrics> {
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

  const pageResponse = await fetch(parsedUrl.href, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!pageResponse.ok) {
    throw new Error(
      `Failed to fetch ${parsedUrl.href}: ${pageResponse.status} ${pageResponse.statusText}`
    );
  }

  const html = await pageResponse.text();
  const $ = cheerio.load(html);

  const metaTitle = $('title').first().text().replace(/\s+/g, ' ').trim();
  const mainH1 =
    $('h1')
      .map((_, element) => getHeadingText($, element))
      .get()
      .find(Boolean) ?? '';

  const trimmedKeyword = targetKeyword?.trim();
  const keywordAutoDetected = !trimmedKeyword;
  const resolvedKeyword = trimmedKeyword || detectPrimaryKeyword(metaTitle, mainH1);

  const criteria = buildCriteria(
    $,
    parsedUrl,
    html,
    resolvedKeyword,
    keywordAutoDetected
  );

  const bodyText = extractBodyText($);
  const keywordFrequencies = computeKeywordFrequencies(bodyText);

  return {
    url: parsedUrl.href,
    overallScore: computeOverallScore(criteria),
    criteria,
    keywordFrequencies,
  };
}

function countTermOccurrences(text: string, term: string): number {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return 0;

  const pattern = new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  return (normalizedText.match(pattern) ?? []).length;
}

function extractExpressionContexts(
  bodyText: string,
  expression: string,
  keywordTokens: Set<string>,
  maxContexts = 1
): string {
  const sanitizedBody = sanitizeSemanticText(bodyText);
  const normalizedBody = normalizeText(sanitizedBody);
  const normalizedExpression = normalizeText(expression);
  if (!normalizedExpression) return '';

  const words = filterSemanticWords(normalizedBody.split(' ').filter(Boolean));
  const expressionTokens = normalizedExpression.split(' ');
  const expressionLength = expressionTokens.length;

  type ContextCandidate = { snippet: string; noiseScore: number; hasKeywordOverlap: boolean };

  const candidates: ContextCandidate[] = [];

  for (let index = 0; index <= words.length - expressionLength; index += 1) {
    const slice = words.slice(index, index + expressionLength);
    if (slice.join(' ') !== normalizedExpression) continue;

    const wordsBefore = Math.min(4, index);
    const wordsAfter = Math.min(5, words.length - index - expressionLength);
    const totalWindow = wordsBefore + expressionLength + wordsAfter;

    let windowStart = index - wordsBefore;
    let windowEnd = index + expressionLength + wordsAfter;

    if (totalWindow > 10) {
      const trimFromEnd = totalWindow - 10;
      windowEnd -= trimFromEnd;
    } else if (totalWindow < 5 && windowStart > 0) {
      windowStart = Math.max(0, windowEnd - 5);
    }

    const windowWords = words.slice(windowStart, windowEnd);
    const hasKeywordOverlap = windowWords.some(word => keywordTokens.has(word));
    if (!hasKeywordOverlap && keywordTokens.size > 0) continue;

    const snippet = cleanContextSnippet(windowWords.join(' '));
    if (!snippet) continue;

    candidates.push({
      snippet,
      noiseScore: scoreContextNoise(snippet),
      hasKeywordOverlap,
    });

    if (candidates.length >= maxContexts * 3) break;
  }

  if (candidates.length === 0) {
    for (let index = 0; index <= words.length - expressionLength; index += 1) {
      const slice = words.slice(index, index + expressionLength);
      if (slice.join(' ') !== normalizedExpression) continue;

      const windowStart = Math.max(0, index - 3);
      const windowEnd = Math.min(words.length, index + expressionLength + 4);
      const snippet = cleanContextSnippet(words.slice(windowStart, windowEnd).join(' '));
      if (!snippet) continue;

      candidates.push({
        snippet,
        noiseScore: scoreContextNoise(snippet),
        hasKeywordOverlap: false,
      });

      if (candidates.length >= maxContexts * 2) break;
    }
  }

  if (candidates.length === 0) return '';

  candidates.sort((a, b) => {
    if (a.hasKeywordOverlap !== b.hasKeywordOverlap) {
      return a.hasKeywordOverlap ? -1 : 1;
    }
    return a.noiseScore - b.noiseScore;
  });

  const best = candidates[0];
  if (!best || best.noiseScore > 0.55) return '';

  return best.snippet;
}

function buildSemanticCorpus(
  bodyText: string,
  metaTitle: string,
  headings: string[]
): string[] {
  const sections = splitSentences(bodyText)
    .filter(sentence => countWords(sentence) >= 8)
    .slice(0, 40);

  return [bodyText, metaTitle, ...headings, ...sections].filter(Boolean);
}

function computeTermTfIdf(term: string, corpus: string[]): number {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm || corpus.length === 0) return 0;

  const primaryDoc = corpus[0] ?? '';
  const primaryTokens = extractContentWords(primaryDoc);
  const totalTerms = primaryTokens.length;
  if (totalTerms === 0) return 0;

  const termFrequency = countTermOccurrences(primaryDoc, normalizedTerm) / totalTerms;

  let documentFrequency = 0;
  for (const document of corpus) {
    if (countTermOccurrences(document, normalizedTerm) > 0) {
      documentFrequency += 1;
    }
  }

  const inverseDocumentFrequency = Math.log((corpus.length + 1) / (documentFrequency + 1));
  return Math.round(termFrequency * inverseDocumentFrequency * 10000) / 10000;
}

function computeKeywordRelevance(
  expression: string,
  keyword: string,
  keywordTokens: Set<string>
): number {
  const normalizedExpression = normalizeText(expression);
  const normalizedKeyword = normalizeText(keyword);

  if (normalizedKeyword && normalizedExpression === normalizedKeyword) {
    return 1;
  }

  const expressionTokens = tokenize(expression);
  if (expressionTokens.length === 0 || keywordTokens.size === 0) return 0;

  const overlap = expressionTokens.filter(token => keywordTokens.has(token)).length;
  const tokenOverlapRatio = overlap / expressionTokens.length;
  const containsFullKeyword = normalizedKeyword.includes(normalizedExpression)
    || normalizedExpression.includes(normalizedKeyword);

  return Math.min(1, tokenOverlapRatio * 0.85 + (containsFullKeyword ? 0.25 : 0));
}

function normalizeRelativeScores(values: number[]): number[] {
  if (values.length === 0) return [];

  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max === min) {
    return values.map((_, index) =>
      values.length === 1 ? 1 : index / (values.length - 1)
    );
  }

  return values.map(value => (value - min) / (max - min));
}

function computeRelevanceWeight(
  normalizedTfIdf: number,
  keywordRelevance: number,
  isTargetKeyword: boolean,
  frequencyRank: number,
  expressionCount: number
): number {
  const frequencyFactor =
    expressionCount <= 1 ? 1 : 1 - frequencyRank / (expressionCount - 1);

  const weight =
    normalizedTfIdf * 0.4 +
    keywordRelevance * 0.35 +
    frequencyFactor * 0.15 +
    (isTargetKeyword ? 0.3 : 0);

  return Math.min(1, Math.max(0, weight));
}

function computeInterestScore(
  tfIdf: number,
  frequencyInTitle: number,
  keywordRelevance: number
): number {
  const tfIdfComponent = Math.min(55, tfIdf * 1200);
  const titleComponent = Math.min(25, frequencyInTitle * 0.35);
  const relevanceComponent = keywordRelevance * 15;

  return Math.min(100, Math.round(tfIdfComponent + titleComponent + relevanceComponent));
}

function collectSemanticExpressions(
  bodyText: string,
  keyword: string,
  keywordFrequencies: KeywordFrequency[]
): string[] {
  const keywordTokens = new Set(tokenize(keyword));
  const candidates = new Set<string>();

  for (const entry of keywordFrequencies) {
    candidates.add(entry.text);
  }

  const bodyTokens = extractContentWords(bodyText);
  for (let size = 2; size <= 3; size += 1) {
    for (const ngram of extractNgrams(bodyTokens, size)) {
      const ngramTokens = tokenize(ngram);
      const isRelated = ngramTokens.some(token => keywordTokens.has(token));
      if (isRelated) {
        candidates.add(ngram);
      }
    }
  }

  for (const token of Array.from(keywordTokens)) {
    if (token.length > 2) {
      candidates.add(token);
    }
  }

  return Array.from(candidates)
    .filter(expression => expression.length > 1 && countTermOccurrences(bodyText, expression) > 0)
    .slice(0, 40);
}

function buildSemanticCriteria(
  bodyText: string,
  metaTitle: string,
  headings: string[],
  keyword: string,
  keywordFrequencies: KeywordFrequency[],
  competitorPages: CompetitorPageSnapshot[]
): SemanticCriterion[] {
  const sanitizedBodyText = sanitizeSemanticText(bodyText);
  const totalWords = splitWords(sanitizedBodyText).length;
  const keywordTokens = new Set(tokenize(keyword));
  const normalizedKeyword = normalizeText(keyword);
  const corpus = buildSemanticCorpus(sanitizedBodyText, metaTitle, headings);
  const expressions = collectSemanticExpressions(sanitizedBodyText, keyword, keywordFrequencies);

  const rawMetrics = expressions.map(expression => {
    const current = countTermOccurrences(sanitizedBodyText, expression);
    const tfIdf = computeTermTfIdf(expression, corpus);
    const keywordRelevance = computeKeywordRelevance(expression, keyword, keywordTokens);
    const isTargetKeyword = normalizeText(expression) === normalizedKeyword;

    return {
      expression,
      current,
      tfIdf,
      keywordRelevance,
      isTargetKeyword,
    };
  });

  const sortedByFrequency = [...rawMetrics].sort((a, b) => b.current - a.current);
  const frequencyRankByExpression = new Map(
    sortedByFrequency.map((entry, index) => [entry.expression, index])
  );

  const normalizedTfIdfScores = normalizeRelativeScores(rawMetrics.map(entry => entry.tfIdf));

  const criteria = rawMetrics.map((entry, index) => {
    const normalizedTfIdf = normalizedTfIdfScores[index] ?? 0;
    const frequencyRank = frequencyRankByExpression.get(entry.expression) ?? 0;
    const relevanceWeight = computeRelevanceWeight(
      normalizedTfIdf,
      entry.keywordRelevance,
      entry.isTargetKeyword,
      frequencyRank,
      rawMetrics.length
    );
    const benchmark = computeExpressionBenchmark(competitorPages, page =>
      countTermOccurrences(page.bodyText, entry.expression)
    );
    const { min, max, maxCompetition } =
      competitorPages.length > 0
        ? deriveIdealOccurrenceFromDensity(
            totalWords,
            benchmark,
            relevanceWeight,
            entry.isTargetKeyword
          )
        : deriveFallbackIdealOccurrence(totalWords, relevanceWeight, entry.isTargetKeyword);
    const occurrence = { current: entry.current, maxCompetition };
    const idealOccurrence = { min, max };
    const titleOccurrences = countTermOccurrences(metaTitle, entry.expression);
    const frequencyInTitle =
      titleOccurrences > 0
        ? Math.min(
            100,
            Math.round((titleOccurrences / Math.max(1, tokenize(metaTitle).length)) * 100)
          )
        : 0;
    const context = extractExpressionContexts(sanitizedBodyText, entry.expression, keywordTokens);
    const interestScore = computeInterestScore(
      entry.tfIdf,
      frequencyInTitle,
      entry.keywordRelevance
    );

    if (!context || scoreContextNoise(context) > 0.55) {
      return null;
    }

    return {
      expression: entry.expression,
      context,
      occurrence,
      idealOccurrence,
      frequencyInTitle,
      tfIdf: entry.tfIdf,
      interestScore,
    };
  });

  return criteria
    .filter((criterion): criterion is SemanticCriterion => criterion !== null)
    .sort((a, b) => b.interestScore - a.interestScore);
}

type SerpOrganicItem = {
  type?: string;
  title?: string;
  description?: string;
  url?: string;
};

type SerpTask = {
  status_code?: number;
  status_message?: string;
  result?: Array<{
    items?: SerpOrganicItem[];
  }>;
};

function normalizeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function getDataForSeoCredentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) {
    return null;
  }

  return { login, password };
}

async function fetchSerpCompetitorUrls(
  keyword: string,
  locationCode: number,
  excludeHostname: string
): Promise<string[]> {
  const credentials = getDataForSeoCredentials();
  if (!credentials) {
    return [];
  }

  const authToken = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const serpResponse = await fetch(DATAFORSEO_SERP_ORGANIC_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword,
          location_code: locationCode,
          language_name: 'English',
          depth: 10,
        },
      ]),
    });

    if (!serpResponse.ok) {
      return [];
    }

    const serpPayload = (await serpResponse.json()) as { tasks?: SerpTask[] };
    const serpTask = serpPayload.tasks?.[0];

    if (!serpTask || (serpTask.status_code && serpTask.status_code !== 20000)) {
      return [];
    }

    const organicItems = (serpTask.result?.[0]?.items ?? []).filter(
      item =>
        item.type === 'organic' &&
        item.url &&
        normalizeHostname(item.url) !== excludeHostname
    );

    return organicItems
      .map(item => item.url?.trim())
      .filter((url): url is string => Boolean(url))
      .slice(0, 10);
  } catch {
    return [];
  }
}

async function scrapeCompetitorSnapshot(url: string): Promise<CompetitorPageSnapshot | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const bodyText = sanitizeSemanticText(extractBodyText($));
    const wordCount = splitWords(bodyText).length;

    if (wordCount < 80) {
      return null;
    }

    return { url, bodyText, wordCount };
  } catch {
    return null;
  }
}

async function fetchCompetitorPageSnapshots(
  keyword: string,
  locationCode: number,
  targetUrl: string
): Promise<CompetitorPageSnapshot[]> {
  const excludeHostname = normalizeHostname(targetUrl);
  const competitorUrls = await fetchSerpCompetitorUrls(keyword, locationCode, excludeHostname);

  if (competitorUrls.length === 0) {
    return [];
  }

  const scrapeResults = await Promise.allSettled(
    competitorUrls.map(url => scrapeCompetitorSnapshot(url))
  );

  const pages = scrapeResults
    .filter(
      (result): result is PromiseFulfilledResult<CompetitorPageSnapshot | null> =>
        result.status === 'fulfilled'
    )
    .map(result => result.value)
    .filter((page): page is CompetitorPageSnapshot => page !== null);

  return filterWordCountOutliers(pages);
}

export async function runSemanticAnalysis(
  url: string,
  targetKeyword: string,
  locationCode = DEFAULT_SEMANTIC_LOCATION_CODE
): Promise<SemanticAnalysisResult> {
  const trimmedUrl = url.trim();
  const trimmedKeyword = targetKeyword.trim();

  if (!trimmedUrl) {
    throw new Error('URL is required');
  }
  if (!trimmedKeyword) {
    throw new Error('Target keyword is required for semantic analysis');
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

  const [pageResponse, competitorPages] = await Promise.all([
    fetch(parsedUrl.href, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    }),
    fetchCompetitorPageSnapshots(trimmedKeyword, locationCode, parsedUrl.href),
  ]);

  if (!pageResponse.ok) {
    throw new Error(
      `Failed to fetch ${parsedUrl.href}: ${pageResponse.status} ${pageResponse.statusText}`
    );
  }

  const html = await pageResponse.text();
  const $ = cheerio.load(html);

  const metaTitle = $('title').first().text().replace(/\s+/g, ' ').trim();
  const headings = $('h1, h2, h3')
    .map((_, element) => getHeadingText($, element))
    .get()
    .filter(Boolean);
  const bodyText = extractBodyText($);
  const sanitizedBodyText = sanitizeSemanticText(bodyText);
  const totalWords = splitWords(sanitizedBodyText).length;
  const keywordFrequencies = computeKeywordFrequencies(sanitizedBodyText);
  const criteria = buildSemanticCriteria(
    sanitizedBodyText,
    metaTitle,
    headings,
    trimmedKeyword,
    keywordFrequencies,
    competitorPages
  );

  return {
    url: parsedUrl.href,
    targetKeyword: trimmedKeyword,
    totalWords,
    semanticScore: computeSemanticScore(criteria),
    criteria,
  };
}

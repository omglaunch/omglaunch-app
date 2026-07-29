import type { Cheerio, CheerioAPI } from 'cheerio/slim';
import type { Element } from 'domhandler';
import type { TrustSignals } from '@/lib/competitor-compare-data';

const CHROME_ANCESTOR_SELECTOR = 'header, footer, nav, aside';
const STAT_PERCENT_PATTERN = /\d+(?:\.\d+)?%/g;
const STAT_CURRENCY_PATTERN =
  /(?:\$|€|£|RM|MYR|USD|SGD)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:\$|€|£|RM|MYR|USD|SGD)/gi;
const STAT_QUANTIFIED_PATTERN =
  /\d[\d,]*\+?\s*(?:years?|yrs?|clients?|members?|locations?|trainers?|reviews?|sessions?|studios?)/gi;

export type ContentImageCounts = {
  total: number;
  missingAlt: number;
  backgroundImages: number;
};

function normalizePageDomain(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isExternalHttpLink(href: string, pageDomain: string): boolean {
  const trimmed = href.trim();
  if (!trimmed.startsWith('http')) {
    return false;
  }

  try {
    const linkDomain = new URL(trimmed).hostname.toLowerCase().replace(/^www\./, '');
    return Boolean(pageDomain && linkDomain !== pageDomain);
  } catch {
    return false;
  }
}

export function countTrustSignalsFromText(text: string): Pick<TrustSignals, 'quotes' | 'statistics'> {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const blockquoteQuotes = 0;
  const quotedTextCount = (normalized.match(/"[^"]{2,}"/g) ?? []).length;
  const curlyQuotedCount = (normalized.match(/[“"][^”"]{2,}[”"]/g) ?? []).length;

  const statKeys = new Set<string>();
  for (const pattern of [STAT_PERCENT_PATTERN, STAT_CURRENCY_PATTERN, STAT_QUANTIFIED_PATTERN]) {
    const matches = normalized.match(pattern) ?? [];
    matches.forEach(match => statKeys.add(match.toLowerCase()));
  }

  return {
    quotes: blockquoteQuotes + quotedTextCount + curlyQuotedCount,
    statistics: statKeys.size,
  };
}

function elementHasBackgroundImage(
  style: string | undefined | null,
  attrs: Record<string, string | undefined>
): boolean {
  if (style && /background-image\s*:\s*url/i.test(style)) {
    return true;
  }

  const candidate =
    attrs['data-bg'] ??
    attrs['data-background'] ??
    attrs['data-bg-url'] ??
    attrs['data-background-image'];

  return Boolean(candidate?.trim());
}

export function countContentImagesCheerio(
  $: CheerioAPI,
  contentRoot: Cheerio<Element>
): ContentImageCounts {
  let missingAlt = 0;
  let imgCount = 0;
  let backgroundImages = 0;

  contentRoot.find('img').each((_, image) => {
    imgCount += 1;
    const alt = $(image).attr('alt');
    if (!alt?.trim()) {
      missingAlt += 1;
    }
  });

  contentRoot.find('*').each((_, element) => {
    const $element = $(element);
    if ($element.is('img')) {
      return;
    }

    const style = $element.attr('style');
    const attrs = {
      'data-bg': $element.attr('data-bg'),
      'data-background': $element.attr('data-background'),
      'data-bg-url': $element.attr('data-bg-url'),
      'data-background-image': $element.attr('data-background-image'),
    };

    if (elementHasBackgroundImage(style, attrs)) {
      backgroundImages += 1;
      missingAlt += 1;
    }
  });

  return {
    total: imgCount + backgroundImages,
    missingAlt,
    backgroundImages,
  };
}

export function extractTrustSignalsCheerio(
  $: CheerioAPI,
  pageUrl: string,
  contentRoot: Cheerio<Element>,
  bodyText: string
): TrustSignals {
  const pageDomain = normalizePageDomain(pageUrl);
  let outboundLinks = 0;

  $('body')
    .find('a[href]')
    .each((_, anchor) => {
      const $anchor = $(anchor);
      if ($anchor.closest(CHROME_ANCESTOR_SELECTOR).length > 0) {
        return;
      }

      const href = $anchor.attr('href');
      if (href && isExternalHttpLink(href, pageDomain)) {
        outboundLinks += 1;
      }
    });

  const blockquoteCount = $('body')
    .find('blockquote')
    .filter((_, element) => $(element).closest(CHROME_ANCESTOR_SELECTOR).length === 0).length;

  const textSignals = countTrustSignalsFromText(bodyText);

  const trustScopeText: string[] = [bodyText];
  $('body')
    .find('main, article, #content, section, [class*="elementor-section"]')
    .each((_, element) => {
      const $element = $(element);
      if ($element.closest(CHROME_ANCESTOR_SELECTOR).length > 0) {
        return;
      }
      const text = $element.text().replace(/\s+/g, ' ').trim();
      if (text) {
        trustScopeText.push(text);
      }
    });

  const expandedTextSignals = countTrustSignalsFromText(trustScopeText.join(' '));

  return {
    outboundLinks,
    quotes: blockquoteCount + textSignals.quotes,
    statistics: Math.max(textSignals.statistics, expandedTextSignals.statistics),
  };
}

/** Browser-side trust/image helpers (mirrors Cheerio logic for Puppeteer evaluate). */
export const TRUST_SIGNAL_BROWSER_HELPERS = `
function __poNormalizeDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.toLowerCase().replace(/^www\\./, '');
  } catch {
    return '';
  }
}

function __poIsExternalLink(href, pageDomain) {
  if (!href || !href.trim().startsWith('http')) return false;
  try {
    const linkDomain = new URL(href.trim()).hostname.toLowerCase().replace(/^www\\./, '');
    return Boolean(pageDomain && linkDomain !== pageDomain);
  } catch {
    return false;
  }
}

function __poCountTrustFromText(text) {
  const normalized = (text || '').replace(/\\s+/g, ' ').trim();
  const quotedTextCount = (normalized.match(/"[^"]{2,}"/g) || []).length;
  const curlyQuotedCount = (normalized.match(/[“"][^”"]{2,}[”"]/g) || []).length;
  const statKeys = new Set();
  [/\\d+(?:\\.\\d+)?%/g, /(?:\\$|€|£|RM|MYR|USD|SGD)\\s?\\d[\\d,]*(?:\\.\\d+)?|\\d[\\d,]*(?:\\.\\d+)?\\s?(?:\\$|€|£|RM|MYR|USD|SGD)/gi, /\\d[\\d,]*\\+?\\s*(?:years?|yrs?|clients?|members?|locations?|trainers?|reviews?|sessions?|studios?)/gi]
    .forEach((pattern) => {
      const matches = normalized.match(pattern) || [];
      matches.forEach((match) => statKeys.add(match.toLowerCase()));
    });
  return {
    quotes: quotedTextCount + curlyQuotedCount,
    statistics: statKeys.size,
  };
}

function __poHasBackgroundImage(element) {
  const style = element.getAttribute('style') || '';
  if (/background-image\\s*:\\s*url/i.test(style)) return true;
  return Boolean(
    element.getAttribute('data-bg') ||
      element.getAttribute('data-background') ||
      element.getAttribute('data-bg-url') ||
      element.getAttribute('data-background-image')
  );
}

function __poCountContentImages(contentRoot) {
  let imgCount = 0;
  let missingAlt = 0;
  let backgroundImages = 0;
  contentRoot.querySelectorAll('img').forEach((image) => {
    imgCount += 1;
    if (!image.getAttribute('alt')?.trim()) missingAlt += 1;
  });
  contentRoot.querySelectorAll('*').forEach((element) => {
    if (element.tagName === 'IMG') return;
    if (__poHasBackgroundImage(element)) {
      backgroundImages += 1;
      missingAlt += 1;
    }
  });
  return { total: imgCount + backgroundImages, missingAlt, backgroundImages };
}

function __poExtractTrustSignals(pageUrl, contentRoot, bodyText) {
  const pageDomain = __poNormalizeDomain(pageUrl);
  let outboundLinks = 0;
  document.body.querySelectorAll('a[href]').forEach((anchor) => {
    if (anchor.closest('header, footer, nav, aside')) return;
    const href = anchor.getAttribute('href');
    if (__poIsExternalLink(href, pageDomain)) outboundLinks += 1;
  });

  let blockquoteCount = 0;
  document.body.querySelectorAll('blockquote').forEach((blockquote) => {
    if (!blockquote.closest('header, footer, nav, aside')) blockquoteCount += 1;
  });

  const baseSignals = __poCountTrustFromText(bodyText);
  const scopeParts = [bodyText];
  document.body.querySelectorAll('main, article, #content, section, [class*="elementor-section"]').forEach((node) => {
    if (node.closest('header, footer, nav, aside')) return;
    const text = (node.innerText || '').replace(/\\s+/g, ' ').trim();
    if (text) scopeParts.push(text);
  });
  const expandedSignals = __poCountTrustFromText(scopeParts.join(' '));

  return {
    outboundLinks,
    quotes: blockquoteCount + baseSignals.quotes,
    statistics: Math.max(baseSignals.statistics, expandedSignals.statistics),
  };
}
`;

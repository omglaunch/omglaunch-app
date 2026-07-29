import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BLOCK_LEVEL_SELECTOR =
  'div,p,li,h1,h2,h3,h4,h5,h6,section,article,header,footer,tr,td,th,blockquote,pre,hr,table,ul,ol,dl,dt,dd,figure,figcaption,address,main,aside';

export function extractCleanBodyText(html: string): string {
  const $ = cheerio.load(html);
  const bodyHtml = $('body').html();

  if (!bodyHtml) {
    return '';
  }

  const $content = cheerio.load(`<div id="page-text-root">${bodyHtml}</div>`);
  $content('script, style, noscript, nav').remove();
  $content('br').replaceWith(' ');
  $content(BLOCK_LEVEL_SELECTOR).each((_, element) => {
    $content(element).append(' ');
  });

  return $content('#page-text-root').text().replace(/\s+/g, ' ').trim();
}

export async function fetchPageCleanText(url: string): Promise<string> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  const response = await fetch(trimmedUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    return '';
  }

  const html = await response.text();
  return extractCleanBodyText(html);
}

export function countPhraseOccurrences(cleanText: string, phrase: string): number {
  const normalizedPhrase = phrase.trim().replace(/\s+/g, ' ');
  if (!normalizedPhrase || !cleanText) {
    return 0;
  }

  const normalizedText = cleanText.replace(/\s+/g, ' ').trim();
  const escapedPhrase = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');
  return (normalizedText.match(regex) ?? []).length;
}

export function countPhraseOccurrencesOnPage(cleanText: string, phrases: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const phrase of phrases) {
    counts.set(phrase, countPhraseOccurrences(cleanText, phrase));
  }

  return counts;
}

/**
 * Helpers to approximate visible on-page text when scraping static HTML.
 * Elementor/WordPress builders duplicate entire sections per breakpoint
 * (elementor-hidden-mobile/tablet/desktop). Cheerio counts all copies; browsers do not.
 */

import type { Cheerio, CheerioAPI } from 'cheerio/slim';
import type { Element } from 'domhandler';
import { countWords } from '@/lib/scrape-content';

export const ALWAYS_HIDDEN_SELECTORS = [
  '.elementor-hidden-desktop',
  '.elementor-invisible',
  '[aria-hidden="true"]',
  '.hidden-html',
  '[hidden]',
  '.sr-only',
  '.screen-reader-text',
  '.visually-hidden',
] as const;

export const RESPONSIVE_DUPLICATE_SELECTORS = [
  '.elementor-hidden-tablet',
  '.elementor-hidden-mobile',
] as const;

/** Word-count threshold above which Cheerio likely still has Elementor breakpoint duplicates. */
export const ELEMENTOR_DEDUPE_WORD_THRESHOLD = 1200;

const INLINE_HIDDEN_STYLE_PATTERN = /display\s*:\s*none|visibility\s*:\s*hidden/i;

export function isInlineHiddenStyle(style: string | undefined | null): boolean {
  if (!style?.trim()) {
    return false;
  }

  return INLINE_HIDDEN_STYLE_PATTERN.test(style);
}

function removeSelectors($: CheerioAPI, root: Cheerio<Element>, selectors: readonly string[]): void {
  selectors.forEach(selector => {
    root.find(selector).remove();
  });
}

function removeInlineHidden($: CheerioAPI, root: Cheerio<Element>): void {
  root.find('[style]').each((_, element) => {
    const style = $(element).attr('style');
    if (isInlineHiddenStyle(style)) {
      $(element).remove();
    }
  });
}

export function removeHiddenContentFromCheerio($: CheerioAPI, root: Cheerio<Element>): void {
  removeSelectors($, root, ALWAYS_HIDDEN_SELECTORS);
  removeInlineHidden($, root);

  const wordCount = countWords(root.text());
  if (wordCount <= ELEMENTOR_DEDUPE_WORD_THRESHOLD) {
    return;
  }

  removeSelectors($, root, RESPONSIVE_DUPLICATE_SELECTORS);
  removeInlineHidden($, root);
}

/** Remove hidden/responsive-duplicate nodes from a live DOM subtree before measuring text. */
export function removeHiddenContentFromDom(root: ParentNode): void {
  ALWAYS_HIDDEN_SELECTORS.forEach(selector => {
    root.querySelectorAll(selector).forEach(element => {
      element.remove();
    });
  });

  root.querySelectorAll<HTMLElement>('[style]').forEach(element => {
    if (isInlineHiddenStyle(element.getAttribute('style'))) {
      element.remove();
    }
  });
}

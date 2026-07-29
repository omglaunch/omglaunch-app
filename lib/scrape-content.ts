export function countWords(text: string): number {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    return 0;
  }

  return cleanText.split(/\s+/).filter(word => word.length > 0).length;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function sanitizeBodyText(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\breviews?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type BrowserScrapePayload = {
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
  wordCount: number;
  images: {
    total: number;
    missingAlt: number;
    backgroundImages?: number;
  };
  trustSignals: {
    outboundLinks: number;
    quotes: number;
    statistics: number;
  };
  schemaTypes: string[];
};

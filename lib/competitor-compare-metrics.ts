const RELEVANT_SCHEMA_TYPES = [
  'FAQPage',
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Product',
  'HowTo',
  'WebPage',
  'Organization',
] as const;

function normalizeSchemaType(type: unknown): string | null {
  if (typeof type !== 'string' || !type.trim()) {
    return null;
  }

  return type.replace(/^https?:\/\/schema\.org\//i, '').trim();
}

export function collectSchemaTypesFromJsonLd(value: unknown, types: Set<string>): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectSchemaTypesFromJsonLd(item, types));
    return;
  }

  const record = value as Record<string, unknown>;
  const typeValue = record['@type'];

  if (typeof typeValue === 'string') {
    const normalized = normalizeSchemaType(typeValue);
    if (normalized) {
      types.add(normalized);
    }
  } else if (Array.isArray(typeValue)) {
    typeValue.forEach(entry => {
      const normalized = normalizeSchemaType(entry);
      if (normalized) {
        types.add(normalized);
      }
    });
  }

  if (Array.isArray(record['@graph'])) {
    collectSchemaTypesFromJsonLd(record['@graph'], types);
  }
}

export function parseSchemaTypesFromJsonLdBlocks(blocks: string[]): string[] {
  const types = new Set<string>();

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    try {
      collectSchemaTypesFromJsonLd(JSON.parse(trimmed), types);
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  return Array.from(types).sort((a, b) => a.localeCompare(b));
}

function countSyllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!normalized) {
    return 0;
  }

  if (normalized.length <= 3) {
    return 1;
  }

  let working = normalized.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  working = working.replace(/^y/, '');
  const matches = working.match(/[aeiouy]{1,2}/g);
  return matches?.length ?? 1;
}

export function computeFleschKincaidGradeLevel(text: string): number | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return null;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  const sentences = clean.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);

  if (words.length === 0 || sentences.length === 0) {
    return null;
  }

  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const grade =
    0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;

  return Math.round(Math.max(0, grade) * 10) / 10;
}

export function formatReadabilityGrade(grade: number | null | undefined): string {
  if (grade === null || grade === undefined || !Number.isFinite(grade)) {
    return 'Data Unavailable';
  }

  return `Grade ${grade.toFixed(1)}`;
}

export function formatSchemaTypes(types: string[] | undefined | null): string {
  if (!types?.length) {
    return 'None detected';
  }

  const relevant = types.filter(type =>
    RELEVANT_SCHEMA_TYPES.some(relevantType => type.includes(relevantType))
  );

  if (relevant.length === 0) {
    return types.slice(0, 3).join(', ');
  }

  return relevant.join(', ');
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Placeholder until page-level backlink API is wired. */
export function derivePageReferringDomainsPlaceholder(url: string): number {
  return 8 + (hashString(url) % 192);
}

/** Placeholder Lighthouse-style mobile score (0–100) until PageSpeed API is wired. */
export function deriveMobilePageSpeedPlaceholder(url: string, wordCount: number): number {
  const contentPenalty = Math.min(40, Math.floor(wordCount / 35));
  const variance = hashString(url) % 18;
  return Math.max(22, Math.min(98, 96 - contentPenalty - variance));
}

export function formatMobilePageSpeed(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'Data Unavailable';
  }

  return `${Math.round(score)}/100`;
}

export function formatPageReferringDomains(count: number | null | undefined): string {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return 'Data Unavailable';
  }

  return count.toLocaleString();
}

export function formatSearchVolumeBadge(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value.toLocaleString();
}

export function formatKeywordDifficultyBadge(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}/100`;
}

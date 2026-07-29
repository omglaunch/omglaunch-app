import type { StagingPromptRow, StagingRowError } from './types';

/** Strict string normalization — trim + strip zero-width chars */
export function normalizePromptString(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeClusterKey(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
}

/** Generate immutable UUID at ingestion time (never in render). */
export function mintPromptUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback — still outside React render when called from store/workers
  return `prompt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export function recomputeRowErrors(row: StagingPromptRow): StagingRowError[] {
  const errors: StagingRowError[] = [];
  if (!row.prompt.trim()) errors.push('empty_prompt');
  if (row.geoPending || !row.geo?.locationId) errors.push('geo_unresolved');
  return errors;
}

export function hasBlockingErrors(row: StagingPromptRow): boolean {
  return recomputeRowErrors(row).length > 0 || row.errors.length > 0;
}

/** Markdown code-fence strip before JSON.parse */
export function stripMarkdownCodeBlocks(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function safeParseLlmJsonArray<T>(raw: string): T[] {
  const cleaned = stripMarkdownCodeBlocks(raw);
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { prompts?: unknown }).prompts)) {
      return (parsed as { prompts: T[] }).prompts;
    }
    return [];
  } catch {
    return [];
  }
}

/** CSV formula-injection sanitization */
export function sanitizeCsvCell(value: string): string {
  const v = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (/^[=+\-@]/.test(v)) {
    return `'${v}`;
  }
  return v;
}

/** Strip UTF-8 BOM at buffer level */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  if (text.startsWith('\uFEFF')) return text.slice(1);
  return text;
}

export function fuzzyHeaderMatch(
  header: string,
  candidates: string[]
): string | null {
  const h = header.trim().toLowerCase().replace(/[_\s-]+/g, '');
  for (const c of candidates) {
    const n = c.toLowerCase().replace(/[_\s-]+/g, '');
    if (h === n || h.includes(n) || n.includes(h)) return c;
  }
  return null;
}

export const PROMPT_HEADER_ALIASES = [
  'prompt',
  'prompt string',
  'query',
  'keyword',
  'search query',
  'question',
];
export const CLUSTER_HEADER_ALIASES = [
  'cluster',
  'target cluster',
  'category',
  'group',
  'topic',
];
export const LOCATION_HEADER_ALIASES = [
  'location',
  'geo',
  'geo target',
  'market',
  'country',
  'city',
];

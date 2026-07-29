/**
 * Strict HTML sanitization for CSV cells — main-thread only (no jsdom workers).
 * Mirrors ai-visibility sanitize allowlist approach.
 */

export function encodeHtmlEntities(dirty: string): string {
  return dirty
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Post-worker main-thread sanitization for prompt/cluster strings */
export function sanitizeIngestedText(dirty: string): string {
  // Strip tags entirely — prompts should be plain text
  const noTags = dirty.replace(/<[^>]*>/g, '');
  return encodeHtmlEntities(noTags)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

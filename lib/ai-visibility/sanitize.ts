/**
 * Strict LLM HTML/Markdown sanitization — no jsdom / isomorphic-dompurify.
 * Those packages break Next.js client bundles (undici/wrap-handler).
 * Allowlist strip works on both server and browser.
 */

const ALLOWED_TAGS = new Set([
  'b',
  'i',
  'em',
  'strong',
  'a',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'code',
  'span',
]);

const ALLOWED_ATTR = new Set(['href', 'title', 'rel', 'target', 'class']);

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  // Block javascript:, data:, vbscript:, etc.
  return /^(https?:|mailto:|\/|#)/i.test(trimmed);
}

/**
 * Strip disallowed tags/attrs. Void + paired tags only from the allowlist.
 * Anything else is escaped as text.
 */
export function sanitizeLlmMarkdownSync(dirty: string): string {
  if (!dirty) return '';

  // Fast-path: if no tags, escape entities only
  if (!/<[a-z!/?]/i.test(dirty)) {
    return escapeText(dirty);
  }

  return dirty.replace(
    /<\/?([a-z0-9]+)(\s[^>]*)?>/gi,
    (full, rawTag: string, rawAttrs = '') => {
      const tag = rawTag.toLowerCase();
      const isClosing = full.startsWith('</');

      if (!ALLOWED_TAGS.has(tag)) {
        return escapeText(full);
      }

      if (isClosing) {
        return `</${tag}>`;
      }

      if (tag === 'br') {
        return '<br>';
      }

      if (!rawAttrs || !rawAttrs.trim()) {
        return `<${tag}>`;
      }

      const attrs: string[] = [];
      const attrRe =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
      let match: RegExpExecArray | null;
      while ((match = attrRe.exec(rawAttrs)) !== null) {
        const name = match[1]!.toLowerCase();
        if (!ALLOWED_ATTR.has(name)) continue;
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        if (name === 'href' && !isSafeHref(value)) continue;
        if (name === 'target' && value !== '_blank' && value !== '_self') continue;
        attrs.push(`${name}="${escapeText(value)}"`);
      }

      // Hardening for external links
      if (attrs.some((a) => a.startsWith('href=')) && tag === 'a') {
        if (!attrs.some((a) => a.startsWith('rel='))) {
          attrs.push('rel="noopener noreferrer"');
        }
      }

      return attrs.length > 0 ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
    }
  );
}

export async function sanitizeLlmMarkdown(dirty: string): Promise<string> {
  return sanitizeLlmMarkdownSync(dirty);
}

/** Cryptographic-ish content hash for ABSA cache invalidation. */
export async function hashSnippet(snippet: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(snippet);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }
  let h = 0;
  for (let i = 0; i < snippet.length; i++) {
    h = (Math.imul(31, h) + snippet.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(h).toString(16)}`;
}

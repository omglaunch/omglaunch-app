/**
 * Strict URL normalization for cannibalization / intent-mismatch comparison.
 * Original URLs are preserved for storage; this is comparison-only.
 */
export function normalizeUrlForComparison(url: string): string {
  let value = url.trim();
  if (!value) return '';

  const hashIndex = value.indexOf('#');
  if (hashIndex >= 0) {
    value = value.slice(0, hashIndex);
  }

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep partially encoded URLs when decoding fails.
  }

  return value
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

export function urlsMatchForRankingIntent(a: string, b: string): boolean {
  const left = normalizeUrlForComparison(a);
  const right = normalizeUrlForComparison(b);
  if (!left || !right) return false;
  return left === right;
}

/** Strip scheme + domain for UI; preserve path and query params. */
export function formatUrlPathForDisplay(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '—';

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const path = `${parsed.pathname}${parsed.search}` || '/';
    if (path === '/') return '/';
    return path.endsWith('/') ? path.slice(0, -1) : path;
  } catch {
    const withoutHash = trimmed.split('#')[0] ?? trimmed;
    const withoutProtocol = withoutHash
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '');
    const slashIndex = withoutProtocol.indexOf('/');
    if (slashIndex >= 0) {
      const path = withoutProtocol.slice(slashIndex);
      return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    }
    return '/';
  }
}

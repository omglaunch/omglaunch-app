/**
 * Brand alias matcher — supports regex and wildcard patterns (e.g. *.yourdomain.*).
 */

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function toMatcher(alias: string): RegExp {
  const trimmed = alias.trim();
  if (!trimmed) return /$a/; // never matches
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const last = trimmed.lastIndexOf('/');
    const body = trimmed.slice(1, last);
    const flags = trimmed.slice(last + 1) || 'i';
    try {
      return new RegExp(body, flags);
    } catch {
      return wildcardToRegExp(trimmed);
    }
  }
  if (trimmed.includes('*') || trimmed.includes('?')) {
    return wildcardToRegExp(trimmed);
  }
  // Domain / hostname contains check
  return new RegExp(trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&'), 'i');
}

export function urlMatchesBrandAliases(
  url: string | null | undefined,
  brandAliases: string[]
): boolean {
  if (!url || brandAliases.length === 0) return false;
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // keep raw
  }
  return brandAliases.some((alias) => {
    const re = toMatcher(alias);
    return re.test(url) || re.test(host);
  });
}

export function textMentionsBrand(
  text: string | null | undefined,
  brandAliases: string[]
): boolean {
  if (!text) return false;
  return brandAliases.some((alias) => {
    const plain = alias.replace(/^\/|\/[a-z]*$/gi, '').replace(/[.*+?^${}()|[\]\\]/g, '');
    if (!plain) return false;
    return new RegExp(plain, 'i').test(text);
  });
}

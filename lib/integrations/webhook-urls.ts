export function parseWebhookUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/** Basic SSRF guard for outbound webhook targets. */
export function isAllowedWebhookUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const host = url.hostname.toLowerCase();
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return false;
    }

    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

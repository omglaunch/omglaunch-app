/**
 * Structural adapter microservices — normalize engine payloads.
 * DOM integrity: abort on CAPTCHA / missing structural markers even if HTTP 200.
 */

export type AdapterAbortReason = 'captcha' | 'missing_markers' | 'timeout' | 'ok';

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AdapterAbortReason; syncFailed: true };

const CAPTCHA_MARKERS = [
  /recaptcha/i,
  /g-recaptcha/i,
  /cf-challenge/i,
  /Attention Required/i,
  /captcha/i,
];

export function assertDomIntegrity(
  html: string,
  requiredMarkers: RegExp[]
): AdapterAbortReason {
  for (const re of CAPTCHA_MARKERS) {
    if (re.test(html)) return 'captcha';
  }
  for (const re of requiredMarkers) {
    if (!re.test(html)) return 'missing_markers';
  }
  return 'ok';
}

/** 2-attempt retry for API timeouts; sync_failed cached 1h by caller. */
export async function withTwoAttemptRetry<T>(
  fn: () => Promise<T>,
  isTimeout: (err: unknown) => boolean = () => true
): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    if (!isTimeout(first)) throw first;
    return await fn();
  }
}

export const GOOGLE_AIO_MARKERS = [
  /AI Overview|ai-overview|kp-wholepage/i,
];

export const PERPLEXITY_MARKERS = [
  /perplexity|citation-list|prose/i,
];

export const CHATGPT_MARKERS = [
  /markdown|message-|assistant/i,
];

export const CLAUDE_MARKERS = [
  /claude|anthropic|font-claude/i,
];

/**
 * Unified SERP task parse — extract Organic Rank + Google AIO in one request.
 * Pass strict Mobile/Desktop User-Agent via `device`.
 */
export type UnifiedSerpParseInput = {
  html: string;
  device: 'desktop' | 'mobile';
  userAgent: string;
  brandAliases: string[];
};

export type UnifiedSerpParseResult = {
  organicRank: number | null;
  aioPresent: boolean;
  aioCitationUrls: string[];
};

export function parseUnifiedSerpTask(
  input: UnifiedSerpParseInput
): AdapterResult<UnifiedSerpParseResult> {
  const integrity = assertDomIntegrity(input.html, GOOGLE_AIO_MARKERS);
  if (integrity !== 'ok') {
    return { ok: false, reason: integrity, syncFailed: true };
  }
  // Structural stub — production adapters live as microservices.
  return {
    ok: true,
    data: {
      organicRank: null,
      aioPresent: /AI Overview/i.test(input.html),
      aioCitationUrls: [],
    },
  };
}

export function desktopUserAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
}

export function mobileUserAgent(): string {
  return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
}

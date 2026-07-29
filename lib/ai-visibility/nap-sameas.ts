/** Normalize and validate NAP + sameAs fields for client brand profiles. */

export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOptionalEmail(value: unknown): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) return null;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    throw new Error('Enter a valid contact email address.');
  }

  return trimmed.toLowerCase();
}

export function normalizeOptionalPhone(value: unknown): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) {
    throw new Error('Enter a valid phone number (at least 7 digits).');
  }

  return trimmed;
}

export function normalizeOptionalAddress(value: unknown): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new Error('Address must be 500 characters or fewer.');
  }
  return trimmed;
}

export function parseSameAsUrlsInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function parseSameAsUrlsJson(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const urls = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeSameAsUrl(item);
    if (normalized) {
      urls.add(normalized);
    }
  }

  return Array.from(urls);
}

export function formatSameAsUrlsInput(urls: string[]): string {
  return urls.join('\n');
}

function normalizeSameAsUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Validate sameAs URLs; throws on the first invalid entry. */
export function normalizeSameAsUrls(urls: string[]): string[] {
  const normalized = new Set<string>();

  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const url = normalizeSameAsUrl(trimmed);
    if (!url) {
      throw new Error(`Invalid profile URL: ${trimmed}`);
    }
    normalized.add(url);
  }

  return Array.from(normalized);
}

export function hasNapData(input: {
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
}): boolean {
  return Boolean(
    normalizeOptionalText(input.contactPhone) ||
      normalizeOptionalText(input.contactEmail) ||
      normalizeOptionalText(input.address)
  );
}

export function hasSameAsData(sameAsUrls: string[] | null | undefined): boolean {
  return Boolean(sameAsUrls && sameAsUrls.length > 0);
}

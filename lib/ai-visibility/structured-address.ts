/** Parse free-text NAP address into Schema.org PostalAddress fields. */

export type StructuredPostalAddress = {
  streetAddress: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
};

const POSTAL_CODE_PATTERN =
  /\b(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z][ -]?\d[A-Z]\d)\b/i;
const US_STATE_PATTERN = /\b([A-Z]{2})\b/;

function cleanSegment(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractPostalCode(segment: string): { postalCode?: string; remainder: string } {
  const match = segment.match(POSTAL_CODE_PATTERN);
  if (!match?.[1]) {
    return { remainder: segment };
  }

  return {
    postalCode: cleanSegment(match[1].toUpperCase()),
    remainder: cleanSegment(segment.replace(match[0], '')),
  };
}

function extractRegion(segment: string): { addressRegion?: string; remainder: string } {
  const trimmed = cleanSegment(segment);
  if (!trimmed) {
    return { remainder: '' };
  }

  if (/^[A-Z]{2}$/i.test(trimmed)) {
    return { addressRegion: trimmed.toUpperCase(), remainder: '' };
  }

  const stateMatch = trimmed.match(US_STATE_PATTERN);
  if (stateMatch?.[1]) {
    return {
      addressRegion: stateMatch[1].toUpperCase(),
      remainder: cleanSegment(trimmed.replace(stateMatch[0], '')),
    };
  }

  return { remainder: trimmed };
}

/**
 * Best-effort parser for comma/newline separated addresses.
 * Examples:
 * - "123 Main St, Seattle, WA 98101"
 * - "10 Jalan Demo, Kuala Lumpur"
 * - "742 Evergreen Terrace"
 */
export function parseStructuredAddress(raw: string): StructuredPostalAddress {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Address is required.');
  }

  const normalized = trimmed.replace(/\n+/g, ', ');
  const parts = normalized
    .split(',')
    .map(part => cleanSegment(part))
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Address is required.');
  }

  if (parts.length === 1) {
    return { streetAddress: parts[0]! };
  }

  if (parts.length === 2) {
    const streetAddress = parts[0]!;
    const tail = parts[1]!;
    const { postalCode, remainder: afterPostal } = extractPostalCode(tail);
    const { addressRegion, remainder: afterRegion } = extractRegion(afterPostal);
    const addressLocality = cleanSegment(afterRegion || afterPostal);

    return {
      streetAddress,
      ...(addressLocality ? { addressLocality } : {}),
      ...(addressRegion ? { addressRegion } : {}),
      ...(postalCode ? { postalCode } : {}),
    };
  }

  const streetAddress = parts.slice(0, -2).join(', ');
  const addressLocality = parts[parts.length - 2]!;
  const tail = parts[parts.length - 1]!;
  const { postalCode, remainder: afterPostal } = extractPostalCode(tail);
  const { addressRegion, remainder: afterRegion } = extractRegion(afterPostal);
  const trailingLocality = cleanSegment(afterRegion);

  return {
    streetAddress,
    addressLocality: trailingLocality || addressLocality,
    ...(addressRegion ? { addressRegion } : {}),
    ...(postalCode ? { postalCode } : {}),
  };
}

export function buildPostalAddressJsonLd(raw: string): Record<string, string> {
  const structured = parseStructuredAddress(raw);
  const node: Record<string, string> = {
    '@type': 'PostalAddress',
    streetAddress: structured.streetAddress,
  };

  if (structured.addressLocality) {
    node.addressLocality = structured.addressLocality;
  }
  if (structured.addressRegion) {
    node.addressRegion = structured.addressRegion;
  }
  if (structured.postalCode) {
    node.postalCode = structured.postalCode;
  }

  return node;
}

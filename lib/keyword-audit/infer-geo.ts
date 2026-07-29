import { RESEARCH_LOCATIONS } from '@/app/(dashboard)/research/research-locations';
import {
  geoFromResearchLocationCode,
  normalizeGeoInput,
  type KeywordAuditGeoInput,
} from '@/lib/keyword-audit/geo';

type GeoHint = {
  pattern: RegExp;
  country: string;
  city?: string;
};

const GEO_HINTS: GeoHint[] = [
  { pattern: /\bkuala\s*lumpur\b|\bkualalumpur\b|\bkl\b/, country: 'Malaysia', city: 'Kuala Lumpur' },
  { pattern: /\bpenang\b|\bgeorge\s+town\b/, country: 'Malaysia', city: 'Penang' },
  { pattern: /\bjohor\b|\bjohor\s+bahru\b|\bjb\b/, country: 'Malaysia', city: 'Johor Bahru' },
  { pattern: /\bmalaysia\b|\.my(?:\/|$)/, country: 'Malaysia' },
  { pattern: /\bsingapore\b|\.sg(?:\/|$)/, country: 'Singapore', city: 'Singapore' },
  { pattern: /\bbangkok\b|\.th(?:\/|$)/, country: 'Thailand', city: 'Bangkok' },
  { pattern: /\bjakarta\b|\.id(?:\/|$)/, country: 'Indonesia' },
  { pattern: /\bmanila\b|\.ph(?:\/|$)/, country: 'Philippines' },
  { pattern: /\bsydney\b|\bmelbourne\b|\bbrisbane\b|\.com\.au(?:\/|$)|\.au(?:\/|$)/, country: 'Australia' },
  { pattern: /\btokyo\b|\bosaka\b|\.jp(?:\/|$)/, country: 'Japan' },
  { pattern: /\bnew\s+york\b|\bnyc\b|\blos\s+angeles\b|\bsan\s+francisco\b|\bchicago\b|\bhouston\b|\baustin\b|\bseattle\b|\bmiami\b|\bdenver\b/, country: 'United States' },
  { pattern: /\bunited\s+states\b|\bamerica\b|\busa\b/, country: 'United States' },
  { pattern: /\blondon\b|\bmanchester\b|\bbirmingham\b|\.co\.uk(?:\/|$)|\.uk(?:\/|$)/, country: 'United Kingdom' },
  { pattern: /\btoronto\b|\bvancouver\b|\bmontreal\b|\.ca(?:\/|$)/, country: 'Canada' },
  { pattern: /\bdubai\b|\buae\b/, country: 'United Arab Emirates', city: 'Dubai' },
  { pattern: /\bparis\b/, country: 'France', city: 'Paris' },
  { pattern: /\bberlin\b|\bmunich\b|\.de(?:\/|$)/, country: 'Germany' },
  { pattern: /\bmumbai\b|\bdelhi\b|\bbangalore\b|\.in(?:\/|$)/, country: 'India' },
];

function matchGeoHint(text: string): GeoHint | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const hint of GEO_HINTS) {
    if (hint.pattern.test(normalized)) {
      return hint;
    }
  }

  for (const location of RESEARCH_LOCATIONS) {
    const label = location.label.toLowerCase();
    const primary = label.split(',')[0]?.trim() ?? label;
    if (primary.length >= 4 && normalized.includes(primary)) {
      if (location.region === 'City' && location.parentCountryCode != null) {
        const country = RESEARCH_LOCATIONS.find(
          entry => entry.region === 'Country' && entry.code === location.parentCountryCode
        );
        return {
          country: country?.label ?? 'Malaysia',
          city: primary,
        };
      }

      if (location.region === 'Country') {
        return { country: location.label };
      }
    }
  }

  return null;
}

export function inferGeoFromKeywordOrUrl(
  keyword: string,
  url: string,
  fallback: Partial<KeywordAuditGeoInput> = {}
): KeywordAuditGeoInput {
  const base = normalizeGeoInput(fallback);
  const combined = [keyword, url].filter(Boolean).join(' ');
  const hint = matchGeoHint(combined);

  if (!hint) {
    return base;
  }

  return normalizeGeoInput({
    ...base,
    country: hint.country,
    city: hint.city ?? base.city,
  });
}

export function geoFromProjectLocationCode(
  locationCode: number | null | undefined
): Partial<KeywordAuditGeoInput> {
  if (locationCode == null || !Number.isFinite(locationCode)) {
    return {};
  }

  return geoFromResearchLocationCode(locationCode);
}

export function hasGeoHintsInText(keyword: string, url: string): boolean {
  const combined = [keyword, url].filter(Boolean).join(' ');
  return matchGeoHint(combined) !== null;
}

import { RESEARCH_LOCATIONS } from '@/app/(dashboard)/research/research-locations';

export type KeywordAuditGeoInput = {
  country: string;
  city?: string;
  language: string;
  device: string;
};

const COUNTRY_ISO_CODES: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  Canada: 'CA',
  Australia: 'AU',
  Singapore: 'SG',
  Malaysia: 'MY',
  India: 'IN',
  Japan: 'JP',
  'South Korea': 'KR',
  Brazil: 'BR',
  Germany: 'DE',
  France: 'FR',
  Spain: 'ES',
  Italy: 'IT',
  Netherlands: 'NL',
  'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA',
  'South Africa': 'ZA',
  Mexico: 'MX',
  Thailand: 'TH',
};

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  Canada: '🇨🇦',
  Australia: '🇦🇺',
  Singapore: '🇸🇬',
  Malaysia: '🇲🇾',
  India: '🇮🇳',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  Brazil: '🇧🇷',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Spain: '🇪🇸',
  Italy: '🇮🇹',
  Netherlands: '🇳🇱',
  'United Arab Emirates': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'South Africa': '🇿🇦',
  Mexico: '🇲🇽',
  Thailand: '🇹🇭',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  ms: 'Malay',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
  id: 'Indonesian',
  hi: 'Hindi',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ar: 'Arabic',
};

export const KEYWORD_AUDIT_COUNTRIES = RESEARCH_LOCATIONS.filter(
  location => location.region === 'Country'
);

export const KEYWORD_AUDIT_DEVICES = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
] as const;

export const KEYWORD_AUDIT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Malay' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'th', label: 'Thai' },
  { value: 'id', label: 'Indonesian' },
  { value: 'hi', label: 'Hindi' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
] as const;

export function resolveLanguageName(languageCode: string): string {
  const normalized = languageCode.trim().toLowerCase();
  return LANGUAGE_LABELS[normalized] ?? 'English';
}

export function resolveLocationCode(country: string, city?: string): number {
  const trimmedCity = city?.trim();
  if (trimmedCity) {
    const cityMatch = RESEARCH_LOCATIONS.find(
      location =>
        location.region === 'City' &&
        location.label.toLowerCase().includes(trimmedCity.toLowerCase())
    );
    if (cityMatch) {
      return cityMatch.code;
    }
  }

  const countryMatch = RESEARCH_LOCATIONS.find(
    location => location.region === 'Country' && location.label === country.trim()
  );

  return countryMatch?.code ?? 2458;
}

export function getCountryIsoCode(country: string): string {
  return COUNTRY_ISO_CODES[country.trim()] ?? country.trim().slice(0, 2).toUpperCase();
}

export function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country.trim()] ?? '🌐';
}

export function formatLanguageBadge(language: string): string {
  return language.trim().toUpperCase().slice(0, 2);
}

export function formatDeviceLabel(device: string): string {
  const normalized = device.trim().toLowerCase();
  return normalized === 'mobile' ? 'Mobile' : 'Desktop';
}

export function normalizeGeoInput(input: Partial<KeywordAuditGeoInput>): KeywordAuditGeoInput {
  return {
    country: input.country?.trim() || 'Malaysia',
    city: input.city?.trim() || undefined,
    language: input.language?.trim().toLowerCase() || 'en',
    device: input.device?.trim().toLowerCase() === 'mobile' ? 'mobile' : 'desktop',
  };
}

export function buildGeoContextLabel(geo: KeywordAuditGeoInput): string {
  const parts = [geo.country];
  if (geo.city) {
    parts.push(geo.city);
  }
  parts.push(resolveLanguageName(geo.language), formatDeviceLabel(geo.device));
  return parts.join(' · ');
}

/** ISO-style market code for Vol/KD badges (e.g. MY, US). */
export function getMetricsGeoAbbreviation(geo: KeywordAuditGeoInput | null | undefined): string | null {
  if (!geo?.country?.trim()) {
    return null;
  }

  return getCountryIsoCode(geo.country);
}

export function geoFromResearchLocationCode(code: number): Partial<KeywordAuditGeoInput> {
  const location = RESEARCH_LOCATIONS.find(entry => entry.code === code);
  if (!location) {
    return {};
  }

  if (location.region === 'Country') {
    return { country: location.label };
  }

  const country = RESEARCH_LOCATIONS.find(
    entry => entry.region === 'Country' && entry.code === location.parentCountryCode
  );

  const city = location.label.split(',')[0]?.trim() || location.label;

  return {
    country: country?.label ?? 'Malaysia',
    city,
  };
}

import { RESEARCH_LOCATIONS } from '@/app/(dashboard)/research/research-locations';
import {
  FALLBACK_WORKSPACE_GEO,
  GLOBAL_GEO,
  type GeoTargetOption,
} from '@/lib/ai-visibility/onboarding/types';

function toGeoOption(loc: (typeof RESEARCH_LOCATIONS)[number]): GeoTargetOption {
  return {
    locationId: String(loc.code),
    label: loc.region === 'Country' ? `${loc.label} - National` : loc.label,
    countryCode: undefined,
    isGlobal: false,
  };
}

/** Normalize CSV / free-text location labels to catalog Location IDs. */
export function matchLocation(raw: string): GeoTargetOption | null {
  const n = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!n) return null;

  // Global / national / US aliases (CSV templates use these often)
  if (
    /^(global(\s*\/\s*national)?|national|us(\s*-?\s*national)?|united states(\s*-?\s*national)?|usa)$/i.test(
      n
    )
  ) {
    if (/^global/i.test(n)) return GLOBAL_GEO;
    return {
      ...FALLBACK_WORKSPACE_GEO,
      label: 'United States - National',
    };
  }

  // Exact / includes on full catalog labels
  const exact = RESEARCH_LOCATIONS.find((loc) => {
    const label = loc.label.toLowerCase();
    const national =
      loc.region === 'Country' ? `${label} - national` : label;
    return (
      label === n ||
      national === n ||
      String(loc.code) === n ||
      label.includes(n) ||
      n.includes(label)
    );
  });
  if (exact) return toGeoOption(exact);

  // "Seattle, WA" / "Seattle WA" → city match on leading token(s)
  const cityToken = n.split(',')[0]?.trim().split(/\s+/)[0] ?? '';
  if (cityToken.length >= 3) {
    const cityHit = RESEARCH_LOCATIONS.find((loc) => {
      if (loc.region !== 'City') return false;
      const city = loc.label.toLowerCase().split(',')[0]?.trim() ?? '';
      return (
        city === cityToken ||
        city.startsWith(cityToken) ||
        cityToken.startsWith(city)
      );
    });
    if (cityHit) return toGeoOption(cityHit);
  }

  // Multi-word cities: "New York, NY" → match full pre-comma segment
  const cityPhrase = n.split(',')[0]?.trim() ?? '';
  if (cityPhrase.includes(' ') && cityPhrase.length >= 3) {
    const phraseHit = RESEARCH_LOCATIONS.find((loc) => {
      if (loc.region !== 'City') return false;
      const city = loc.label.toLowerCase().split(',')[0]?.trim() ?? '';
      return city === cityPhrase || city.startsWith(cityPhrase);
    });
    if (phraseHit) return toGeoOption(phraseHit);
  }

  return null;
}

export { toGeoOption };

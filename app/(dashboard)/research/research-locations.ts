export type ResearchLocation = {
  code: number;
  label: string;
  region: 'Country' | 'City';
  /** DataForSEO Labs only supports country-level location codes. */
  parentCountryCode?: number;
};

export const RESEARCH_LOCATIONS: ResearchLocation[] = [
  { code: 2840, label: 'United States', region: 'Country' },
  { code: 2826, label: 'United Kingdom', region: 'Country' },
  { code: 2124, label: 'Canada', region: 'Country' },
  { code: 2036, label: 'Australia', region: 'Country' },
  { code: 2702, label: 'Singapore', region: 'Country' },
  { code: 2458, label: 'Malaysia', region: 'Country' },
  { code: 2356, label: 'India', region: 'Country' },
  { code: 2392, label: 'Japan', region: 'Country' },
  { code: 2410, label: 'South Korea', region: 'Country' },
  { code: 2076, label: 'Brazil', region: 'Country' },
  { code: 2276, label: 'Germany', region: 'Country' },
  { code: 2250, label: 'France', region: 'Country' },
  { code: 2724, label: 'Spain', region: 'Country' },
  { code: 2380, label: 'Italy', region: 'Country' },
  { code: 2528, label: 'Netherlands', region: 'Country' },
  { code: 2784, label: 'United Arab Emirates', region: 'Country' },
  { code: 2682, label: 'Saudi Arabia', region: 'Country' },
  { code: 2710, label: 'South Africa', region: 'Country' },
  { code: 2484, label: 'Mexico', region: 'Country' },
  { code: 2764, label: 'Thailand', region: 'Country' },
  { code: 1023191, label: 'New York, NY', region: 'City', parentCountryCode: 2840 },
  { code: 1023768, label: 'Los Angeles, CA', region: 'City', parentCountryCode: 2840 },
  { code: 1023143, label: 'Chicago, IL', region: 'City', parentCountryCode: 2840 },
  { code: 1022968, label: 'Houston, TX', region: 'City', parentCountryCode: 2840 },
  { code: 1023619, label: 'San Francisco, CA', region: 'City', parentCountryCode: 2840 },
  { code: 1014221, label: 'Seattle, WA', region: 'City', parentCountryCode: 2840 },
  { code: 1026481, label: 'Austin, TX', region: 'City', parentCountryCode: 2840 },
  { code: 1015105, label: 'Denver, CO', region: 'City', parentCountryCode: 2840 },
  { code: 1015116, label: 'Miami, FL', region: 'City', parentCountryCode: 2840 },
  { code: 1006886, label: 'London, England', region: 'City', parentCountryCode: 2826 },
  { code: 1006094, label: 'Manchester, England', region: 'City', parentCountryCode: 2826 },
  { code: 1005910, label: 'Birmingham, England', region: 'City', parentCountryCode: 2826 },
  { code: 1000543, label: 'Toronto, ON', region: 'City', parentCountryCode: 2124 },
  { code: 1000492, label: 'Vancouver, BC', region: 'City', parentCountryCode: 2124 },
  { code: 1000545, label: 'Montreal, QC', region: 'City', parentCountryCode: 2124 },
  { code: 1000286, label: 'Sydney, NSW', region: 'City', parentCountryCode: 2036 },
  { code: 1000290, label: 'Melbourne, VIC', region: 'City', parentCountryCode: 2036 },
  { code: 1000284, label: 'Brisbane, QLD', region: 'City', parentCountryCode: 2036 },
  { code: 1014229, label: 'Tokyo, Japan', region: 'City', parentCountryCode: 2392 },
  { code: 1014368, label: 'Osaka, Japan', region: 'City', parentCountryCode: 2392 },
  { code: 1007785, label: 'Paris, France', region: 'City', parentCountryCode: 2250 },
  { code: 1003854, label: 'Berlin, Germany', region: 'City', parentCountryCode: 2276 },
  { code: 1004470, label: 'Munich, Germany', region: 'City', parentCountryCode: 2276 },
  { code: 1005424, label: 'Amsterdam, Netherlands', region: 'City', parentCountryCode: 2528 },
  { code: 1005583, label: 'Dubai, UAE', region: 'City', parentCountryCode: 2784 },
  { code: 1007310, label: 'Singapore City', region: 'City', parentCountryCode: 2702 },
  { code: 1004098, label: 'Hong Kong', region: 'City', parentCountryCode: 2344 },
  { code: 1000003, label: 'Bangkok, Thailand', region: 'City', parentCountryCode: 2764 },
  { code: 1000998, label: 'Jakarta, Indonesia', region: 'City', parentCountryCode: 2360 },
  { code: 1000048, label: 'Manila, Philippines', region: 'City', parentCountryCode: 2608 },
  { code: 1000040, label: 'Kuala Lumpur, Malaysia', region: 'City', parentCountryCode: 2458 },
  { code: 1000073, label: 'Mumbai, India', region: 'City', parentCountryCode: 2356 },
  { code: 1000074, label: 'Delhi, India', region: 'City', parentCountryCode: 2356 },
  { code: 1000075, label: 'Bangalore, India', region: 'City', parentCountryCode: 2356 },
  { code: 1000076, label: 'São Paulo, Brazil', region: 'City', parentCountryCode: 2076 },
  { code: 1000077, label: 'Mexico City, Mexico', region: 'City', parentCountryCode: 2484 },
];

const DEFAULT_LABS_LOCATION_CODE = 2458;

export function getResearchLocationLabel(code: number): string {
  return RESEARCH_LOCATIONS.find(location => location.code === code)?.label ?? 'Unknown location';
}

/** DataForSEO Labs endpoints only accept country-level location codes. */
export function resolveDataForSeoLabsLocationCode(code: number): number {
  const location = RESEARCH_LOCATIONS.find(entry => entry.code === code);

  if (!location) {
    return DEFAULT_LABS_LOCATION_CODE;
  }

  if (location.region === 'Country') {
    return location.code;
  }

  if (location.parentCountryCode != null) {
    return location.parentCountryCode;
  }

  return DEFAULT_LABS_LOCATION_CODE;
}

export function getDataForSeoLabsLocationNotice(selectedCode: number): string | null {
  const location = RESEARCH_LOCATIONS.find(entry => entry.code === selectedCode);

  if (!location || location.region !== 'City' || location.parentCountryCode == null) {
    return null;
  }

  const countryLabel = getResearchLocationLabel(location.parentCountryCode);
  return `DataForSEO keyword volumes are country-level only. "${location.label}" uses ${countryLabel} data.`;
}

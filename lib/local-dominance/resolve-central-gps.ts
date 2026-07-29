import { RESEARCH_LOCATIONS } from '@/app/(dashboard)/research/research-locations';
import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';
import type { DataForSeoCredentials } from './dataforseo-maps';
import { businessIdentifiersMatch } from './grid-utils';
import type { GeogridPlatform } from './types';

export type GpsResolveSource = 'manual' | 'business_name' | 'keyword' | 'default_location';

export type ResolvedCentralGps = {
  lat: number;
  lng: number;
  source: GpsResolveSource;
  locationLabel: string;
};

type MapsLookupItem = {
  type?: string;
  title?: string;
  cid?: string;
  place_id?: string;
  latitude?: number;
  longitude?: number;
};

type MapsLookupResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: Array<{
      items?: MapsLookupItem[];
    }>;
  }>;
};

const DEFAULT_LOCATION = RESEARCH_LOCATIONS.find(location => location.label === 'Malaysia')!;

const LOCATION_NOISE = /\b(near me|nearby|close to me|around me)\b/gi;

function normalizeLookupText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function extractLocationFromKeyword(keyword: string): {
  locationCode: number;
  locationLabel: string;
} {
  const cleaned = keyword.replace(LOCATION_NOISE, ' ').trim();
  const normalizedKeyword = normalizeLookupText(cleaned);

  const cityMatches = RESEARCH_LOCATIONS.filter(location => location.region === 'City').sort(
    (a, b) => b.label.length - a.label.length
  );

  for (const location of cityMatches) {
    const cityToken = normalizeLookupText(location.label.split(',')[0] ?? location.label);
    if (cityToken && normalizedKeyword.includes(cityToken)) {
      return { locationCode: location.code, locationLabel: location.label };
    }
  }

  const countryMatches = RESEARCH_LOCATIONS.filter(location => location.region === 'Country').sort(
    (a, b) => b.label.length - a.label.length
  );

  for (const location of countryMatches) {
    const countryToken = normalizeLookupText(location.label);
    if (countryToken && normalizedKeyword.includes(countryToken)) {
      return { locationCode: location.code, locationLabel: location.label };
    }
  }

  return {
    locationCode: DEFAULT_LOCATION.code,
    locationLabel: DEFAULT_LOCATION.label,
  };
}

function resolveMapsEndpoint(platform: GeogridPlatform): string {
  return platform === 'bing'
    ? 'https://api.dataforseo.com/v3/serp/bing/local_pack/live/advanced'
    : 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced';
}

function pickMapsItems(items: MapsLookupItem[] | undefined, platform: GeogridPlatform): MapsLookupItem[] {
  if (!items?.length) return [];

  const preferredTypes =
    platform === 'bing'
      ? new Set(['local_pack', 'maps_search'])
      : new Set(['maps_search']);

  const candidates = items.filter(item => {
    if (!item.title?.trim()) return false;
    if (!item.type) return platform === 'google';
    return preferredTypes.has(item.type);
  });

  return (candidates.length > 0 ? candidates : items.filter(item => item.title?.trim())).slice(0, 5);
}

async function lookupMapsCoordinates(
  credentials: DataForSeoCredentials,
  options: {
    keyword: string;
    locationCode: number;
    platform: GeogridPlatform;
  }
): Promise<MapsLookupItem[]> {
  const response = await fetch(resolveMapsEndpoint(options.platform), {
    method: 'POST',
    headers: {
      Authorization: buildDataForSeoAuthHeader(credentials),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        keyword: options.keyword,
        location_code: options.locationCode,
        language_code: 'en',
        device: 'desktop',
        depth: 5,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO location lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as MapsLookupResponse;
  if (payload.status_code && payload.status_code !== 20_000) {
    throw new Error(payload.status_message ?? 'DataForSEO location lookup failed');
  }

  const task = payload.tasks?.[0];
  if (!task || (task.status_code && task.status_code !== 20_000)) {
    throw new Error(task?.status_message ?? 'DataForSEO location lookup task failed');
  }

  return pickMapsItems(task.result?.[0]?.items, options.platform);
}

function averageCoordinates(items: MapsLookupItem[]): { lat: number; lng: number } | null {
  const points = items.filter(
    item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
  );

  if (points.length === 0) return null;

  const lat = points.reduce((sum, item) => sum + (item.latitude ?? 0), 0) / points.length;
  const lng = points.reduce((sum, item) => sum + (item.longitude ?? 0), 0) / points.length;

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

function isValidManualGps(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export async function resolveCentralGps(
  credentials: DataForSeoCredentials,
  input: {
    keyword: string;
    businessName?: string;
    businessCid?: string;
    centralLat?: number;
    centralLng?: number;
    platform?: GeogridPlatform;
  }
): Promise<ResolvedCentralGps> {
  if (isValidManualGps(input.centralLat, input.centralLng)) {
    return {
      lat: input.centralLat!,
      lng: input.centralLng!,
      source: 'manual',
      locationLabel: `${input.centralLat}, ${input.centralLng}`,
    };
  }

  const platform = input.platform ?? 'google';
  const { locationCode, locationLabel } = extractLocationFromKeyword(input.keyword);
  const businessName = input.businessName?.trim();

  if (businessName) {
    const businessItems = await lookupMapsCoordinates(credentials, {
      keyword: businessName,
      locationCode,
      platform,
    });

    const matched = businessItems.find(item =>
      businessIdentifiersMatch(
        {
          title: item.title ?? '',
          cid: item.cid,
          placeId: item.place_id,
        },
        { businessName, businessCid: input.businessCid }
      )
    );

    const target = matched ?? businessItems[0];
    if (
      target &&
      Number.isFinite(target.latitude) &&
      Number.isFinite(target.longitude)
    ) {
      return {
        lat: Number(target.latitude!.toFixed(6)),
        lng: Number(target.longitude!.toFixed(6)),
        source: 'business_name',
        locationLabel,
      };
    }
  }

  const keywordItems = await lookupMapsCoordinates(credentials, {
    keyword: input.keyword.replace(LOCATION_NOISE, ' ').trim(),
    locationCode,
    platform,
  });

  const averaged = averageCoordinates(keywordItems);
  if (averaged) {
    return {
      ...averaged,
      source: businessName ? 'default_location' : 'keyword',
      locationLabel,
    };
  }

  throw new Error(
    businessName
      ? `Could not auto-detect GPS for "${businessName}" in ${locationLabel}. Enter Central GPS manually.`
      : `Could not auto-detect GPS for "${input.keyword}" in ${locationLabel}. Enter Central GPS manually.`
  );
}

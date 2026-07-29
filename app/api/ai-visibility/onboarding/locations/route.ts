import { NextResponse } from 'next/server';
import { RESEARCH_LOCATIONS } from '@/app/(dashboard)/research/research-locations';
import {
  matchLocation,
  toGeoOption,
} from '@/lib/ai-visibility/onboarding/match-location';
import { GLOBAL_GEO, type GeoTargetOption } from '@/lib/ai-visibility/onboarding/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Async Geo Target autocomplete — standardized Location IDs only (no free-text).
 * Pins Global / National. Backed by Search API provider location catalog.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim().toLowerCase();
    const ids = searchParams.get('ids'); // batch resolve raw location strings

    if (ids) {
      const rawList = ids.split('|').map((s) => s.trim()).filter(Boolean);
      const resolved: Record<string, GeoTargetOption | null> = {};
      for (const raw of rawList) {
        resolved[raw] = matchLocation(raw);
      }
      return NextResponse.json({ resolved });
    }

    const options: GeoTargetOption[] = [
      GLOBAL_GEO,
      ...RESEARCH_LOCATIONS.map((loc) => toGeoOption(loc)),
    ];

    const filtered = q
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.locationId.includes(q) ||
            o.isGlobal
        )
      : options;

    // Always keep Global pinned at top
    const global = filtered.find((o) => o.isGlobal) ?? GLOBAL_GEO;
    const rest = filtered.filter((o) => !o.isGlobal).slice(0, 40);

    return NextResponse.json({ options: [global, ...rest] });
  } catch (error) {
    console.error('[ai-visibility/onboarding/locations] GET', error);
    return NextResponse.json({ error: 'Location lookup failed' }, { status: 500 });
  }
}

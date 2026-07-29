import type { GridCell, GridSize } from './types';

/** Haversine offset in degrees for a given km distance at a latitude. */
function kmToLatOffset(km: number): number {
  return km / 111.32;
}

function kmToLngOffset(km: number, lat: number): number {
  return km / (111.32 * Math.cos((lat * Math.PI) / 180));
}

/**
 * Generates evenly spaced grid coordinates centered on the given GPS point.
 * Radius defines the half-span of the grid from center to edge.
 */
export function buildGridCoordinates(
  centralLat: number,
  centralLng: number,
  radiusKm: number,
  gridSize: GridSize
): Array<{ row: number; col: number; lat: number; lng: number }> {
  const cells: Array<{ row: number; col: number; lat: number; lng: number }> = [];
  const step = (2 * radiusKm) / (gridSize - 1);
  const latStep = kmToLatOffset(step);
  const startLat = centralLat + kmToLatOffset(radiusKm);

  for (let row = 0; row < gridSize; row += 1) {
    const lat = startLat - row * latStep;
    const lngStep = kmToLngOffset(step, lat);
    const startLng = centralLng - (gridSize - 1) * (lngStep / 2);

    for (let col = 0; col < gridSize; col += 1) {
      cells.push({
        row,
        col,
        lat: Number(lat.toFixed(6)),
        lng: Number((startLng + col * lngStep).toFixed(6)),
      });
    }
  }

  return cells;
}

export function emptyGridCell(
  row: number,
  col: number,
  lat: number,
  lng: number
): GridCell {
  return {
    row,
    col,
    lat,
    lng,
    rank: null,
    businessName: null,
    cid: null,
    mapPack: [],
    aiVisible: null,
  };
}

/**
 * Share of Local Voice — percentage of grid cells where the target business ranks in top 3.
 */
export function computeSolv(cells: GridCell[], businessCid?: string, businessName?: string): number {
  if (cells.length === 0) return 0;

  const normalizedCid = businessCid?.trim().toLowerCase();
  const normalizedName = businessName?.trim();

  if (!normalizedCid && !normalizedName) return 0;

  let topThree = 0;
  for (const cell of cells) {
    const matchedEntry = cell.mapPack.find(entry =>
      businessIdentifiersMatch(entry, { businessCid: normalizedCid, businessName: normalizedName })
    );

    const rank = matchedEntry?.rank ?? cell.rank;
    if (rank !== null && rank !== undefined && rank <= 3) {
      topThree += 1;
    }
  }

  return Math.round((topThree / cells.length) * 1000) / 10;
}

/**
 * Share of AI Voice — percentage of grid cells flagged as AI-visible for the business.
 */
export function computeSaiv(cells: GridCell[]): number {
  const withAi = cells.filter(c => c.aiVisible === true);
  if (cells.length === 0) return 0;
  return Math.round((withAi.length / cells.length) * 1000) / 10;
}

export function computeCorporateRollup(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

const GOOGLE_MAPS_MIN_ZOOM = 3;
const GOOGLE_MAPS_MAX_ZOOM = 21;
const EARTH_RADIUS_METERS = 6_378_137;

/**
 * Derive a Google Maps zoom level from grid radius and size.
 * DataForSEO expects location_coordinate as "lat,lng,{zoom}z" (not meters).
 */
export function deriveGoogleMapsZoom(radiusKm: number, gridSize: number, latitude: number): number {
  const cellSpacingKm =
    gridSize > 1 ? (2 * radiusKm) / (gridSize - 1) : Math.max(radiusKm, 0.5);
  const targetMeters = Math.max(cellSpacingKm * 1_000 * 1.25, 200);
  const latRad = (latitude * Math.PI) / 180;
  const metersPerPixel = targetMeters / 512;
  const rawZoom = Math.log2(
    (Math.cos(latRad) * 2 * Math.PI * EARTH_RADIUS_METERS) / (256 * metersPerPixel)
  );

  return Math.max(
    GOOGLE_MAPS_MIN_ZOOM,
    Math.min(GOOGLE_MAPS_MAX_ZOOM, Math.round(rawZoom))
  );
}

/** Build a DataForSEO location_coordinate string for the given platform. */
export function buildLocationCoordinate(
  lat: number,
  lng: number,
  platform: 'google' | 'bing',
  options?: { radiusKm?: number; gridSize?: number }
): string {
  const formattedLat = Number(lat.toFixed(7));
  const formattedLng = Number(lng.toFixed(7));

  if (platform === 'bing') {
    return `${formattedLat},${formattedLng}`;
  }

  const zoom = deriveGoogleMapsZoom(
    options?.radiusKm ?? 5,
    options?.gridSize ?? 5,
    lat
  );
  return `${formattedLat},${formattedLng},${zoom}z`;
}

export function normalizeBusinessLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function businessNamesMatch(candidate: string, target: string): boolean {
  const normalizedCandidate = normalizeBusinessLabel(candidate);
  const normalizedTarget = normalizeBusinessLabel(target);
  if (!normalizedCandidate || !normalizedTarget) return false;

  return (
    normalizedCandidate.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedCandidate)
  );
}

export function businessIdentifiersMatch(
  entry: { title: string; cid?: string | null; placeId?: string | null },
  options?: { businessCid?: string; businessName?: string }
): boolean {
  const normalizedCid = options?.businessCid?.trim().toLowerCase();
  const normalizedName = options?.businessName?.trim();

  if (normalizedCid) {
    const entryCid = entry.cid?.trim().toLowerCase();
    const entryPlaceId = entry.placeId?.trim().toLowerCase();
    if (entryCid === normalizedCid || entryPlaceId === normalizedCid) {
      return true;
    }
  }

  if (normalizedName) {
    return businessNamesMatch(entry.title, normalizedName);
  }

  return false;
}

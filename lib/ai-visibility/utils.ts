import {
  AI_VISIBILITY_CACHE_KEY,
  CLIENT_CACHE_TTL_MS,
  type VisibilityMatrixPage,
  type VisibilityRow,
  type VisibilityFiltersState,
  type CitationStatusFilter,
} from '@/lib/ai-visibility/types';
import {
  hasNegativeContext,
  hasSyncFailed,
  isOmittedEverywhere,
  isPartiallyOmitted,
} from '@/lib/ai-visibility/citation-eval';

export function formatAiSearchVol(vol: number | null): string {
  if (vol === null) return '—';
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}k`;
  return String(vol);
}

export function formatOrganicRank(rank: number | null): string {
  if (rank === null || rank > 100) return '> #100';
  return `#${rank}`;
}

export function formatSharePct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

export function formatDeltaPct(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)} pts`;
}

/** Hydrate ISO timestamps in the user's local timezone (prevents UTC day-boundary skew). */
export function formatLocalSyncStamp(
  iso: string,
  timeZone?: string
): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function uniqueClusters(rows: VisibilityRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.promptCluster))).sort();
}

export function uniqueGeos(rows: VisibilityRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.geoTarget))).sort();
}

export function matchesCitationStatus(
  row: VisibilityRow,
  filter: CitationStatusFilter
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'omitted_everywhere':
      return isOmittedEverywhere(row);
    case 'partially_omitted':
      return isPartiallyOmitted(row);
    case 'sync_failed':
      return hasSyncFailed(row);
    case 'negative_context':
      return hasNegativeContext(row);
  }
}

export function filterVisibilityRows(
  rows: VisibilityRow[],
  filters: VisibilityFiltersState
): VisibilityRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (row.suspended) return false;
    if (filters.promptCluster !== 'all' && row.promptCluster !== filters.promptCluster) {
      return false;
    }
    if (filters.geoTarget !== 'all' && row.geoTarget !== filters.geoTarget) {
      return false;
    }
    if (!matchesCitationStatus(row, filters.citationStatus)) return false;
    if (q) {
      const hay = `${row.prompt} ${row.promptCluster} ${row.geoTarget}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.engine !== 'all') {
      // engine column visibility is handled in the table; still keep all rows
    }
    return true;
  });
}

type ClientCachePayload = {
  projectId: string;
  lastUpdatedAt: string;
  cachedAt: number;
  rows: VisibilityRow[];
};

export function visibilityCacheKey(projectId: string): string {
  return `${AI_VISIBILITY_CACHE_KEY}:${projectId}`;
}

export function readClientCache(
  projectId: string | null,
  serverLastUpdatedAt: string | null
): VisibilityRow[] | null {
  if (typeof window === 'undefined' || !projectId?.trim()) return null;
  try {
    const raw = localStorage.getItem(visibilityCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientCachePayload;
    if (!parsed?.rows?.length || !parsed.cachedAt) return null;
    if (parsed.projectId !== projectId) return null;
    if (Date.now() - parsed.cachedAt > CLIENT_CACHE_TTL_MS) return null;
    if (
      serverLastUpdatedAt &&
      parsed.lastUpdatedAt &&
      Date.parse(serverLastUpdatedAt) > Date.parse(parsed.lastUpdatedAt)
    ) {
      return null;
    }
    return parsed.rows;
  } catch {
    return null;
  }
}

export function writeClientCache(
  projectId: string,
  rows: VisibilityRow[],
  lastUpdatedAt: string
) {
  if (typeof window === 'undefined' || !projectId.trim()) return;
  const payload: ClientCachePayload = {
    projectId,
    lastUpdatedAt,
    cachedAt: Date.now(),
    rows,
  };
  try {
    localStorage.setItem(visibilityCacheKey(projectId), JSON.stringify(payload));
  } catch {
    // quota — ignore
  }
}

export function clearClientCache(projectId?: string) {
  if (typeof window === 'undefined') return;
  if (projectId?.trim()) {
    localStorage.removeItem(visibilityCacheKey(projectId));
    return;
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${AI_VISIBILITY_CACHE_KEY}:`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export function pageFromRows(
  rows: VisibilityRow[],
  cursor: string | null,
  pageSize: number,
  lastUpdatedAt: string
): VisibilityMatrixPage {
  const start = cursor ? Number(cursor) : 0;
  const slice = rows.slice(start, start + pageSize);
  const next =
    start + pageSize < rows.length ? String(start + pageSize) : null;
  return {
    rows: slice,
    nextCursor: next,
    lastUpdatedAt,
    total: rows.length,
  };
}

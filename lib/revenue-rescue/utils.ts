import type {
  DateMode,
  RevenueRescueRow,
  RevenueRescueSummary,
  Segment,
  SortDirection,
  SortField,
  ViewMode,
} from '@/lib/revenue-rescue/types';
import {
  AVG_CONVERSION_VALUE_KEY,
  DEFAULT_AVG_CONVERSION_VALUE,
} from '@/lib/revenue-rescue/types';

export function loadAvgConversionValue(): number {
  if (typeof window === 'undefined') return DEFAULT_AVG_CONVERSION_VALUE;
  const raw = localStorage.getItem(AVG_CONVERSION_VALUE_KEY);
  if (!raw) return DEFAULT_AVG_CONVERSION_VALUE;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_AVG_CONVERSION_VALUE;
}

export function saveAvgConversionValue(value: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AVG_CONVERSION_VALUE_KEY, String(value));
}

/** Clamp delta % to [-100, 100]. */
export function clampDeltaPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(-100, Math.min(100, Math.round(pct)));
}

export function deriveTrafficMetrics(
  peakClicks: number,
  currentClicks: number
): { trafficDelta: number; trafficDeltaPct: number } {
  const peak = Math.max(0, peakClicks);
  const current = Math.max(0, Math.min(currentClicks, peak));
  const trafficDelta = current - peak;
  const trafficDeltaPct =
    peak > 0 ? clampDeltaPct((trafficDelta / peak) * 100) : 0;
  return { trafficDelta, trafficDeltaPct };
}

/** Aggregate fragmented GSC query rows onto a single canonical URL. */
export function aggregateByCanonicalUrl(
  rows: RevenueRescueRow[]
): RevenueRescueRow[] {
  const map = new Map<string, RevenueRescueRow>();

  for (const row of rows) {
    const key = `${row.segment}::${row.canonicalUrl.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...row,
        variants: [...row.variants],
        optimizationGaps: [...row.optimizationGaps],
      });
      continue;
    }

    const variantMap = new Map<string, (typeof row.variants)[number]>();
    for (const v of [...existing.variants, ...row.variants]) {
      const vk = v.keyword.toLowerCase();
      const prev = variantMap.get(vk);
      if (!prev) {
        variantMap.set(vk, { ...v });
      } else {
        variantMap.set(vk, {
          keyword: prev.keyword,
          clicks: prev.clicks + v.clicks,
          impressions: prev.impressions + v.impressions,
        });
      }
    }

    const variants = Array.from(variantMap.values()).sort(
      (a, b) => b.clicks - a.clicks
    );
    const primary = variants[0];

    // Weighted average for clicks — never sum current above peak
    const peakClicks = Math.max(existing.peakClicks, row.peakClicks);
    const currentClicks = Math.min(
      peakClicks - 1,
      Math.round((existing.currentClicks + row.currentClicks) / 2)
    );
    const { trafficDelta, trafficDeltaPct } = deriveTrafficMetrics(
      peakClicks,
      Math.max(1, currentClicks)
    );

    const gaps = Array.from(
      new Set([...existing.optimizationGaps, ...row.optimizationGaps])
    ).slice(0, 3);

    map.set(key, {
      ...existing,
      peakClicks,
      currentClicks: Math.max(1, currentClicks),
      trafficDelta,
      trafficDeltaPct,
      estimatedRevenueAtRisk:
        existing.estimatedRevenueAtRisk + row.estimatedRevenueAtRisk,
      variants,
      targetKeyword: primary?.keyword ?? existing.targetKeyword,
      engagementDeltaPct: Math.round(
        (existing.engagementDeltaPct + row.engagementDeltaPct) / 2
      ),
      // Keep primary rank — averaging + sort-by-rank ASC made every top row look like #11
      currentRank:
        existing.segment === 'striking-distance'
          ? Math.min(25, Math.max(11, existing.currentRank))
          : existing.currentRank,
      searchVolume: Math.max(existing.searchVolume, row.searchVolume),
      estTrafficGain: Math.max(existing.estTrafficGain, row.estTrafficGain),
      optimizationGaps: gaps as RevenueRescueRow['optimizationGaps'],
    });
  }

  return Array.from(map.values());
}

export function computeSummary(
  allRows: RevenueRescueRow[],
  avgConversionValue: number
): RevenueRescueSummary {
  const decaying = allRows.filter((r) => r.segment === 'content-decay');
  const striking = allRows.filter((r) => r.segment === 'striking-distance');
  const totalClicksLost = decaying.reduce(
    (sum, r) => sum + Math.abs(Math.min(0, r.trafficDelta)),
    0
  );
  const estimatedRevenueAtRisk = decaying.reduce(
    (sum, r) =>
      sum +
      (r.estimatedRevenueAtRisk ||
        Math.abs(Math.min(0, r.trafficDelta)) * avgConversionValue * 0.02),
    0
  );
  const estimatedRevenueOpportunity = striking.reduce(
    (sum, r) => sum + r.estTrafficGain * avgConversionValue * 0.02,
    0
  );

  return {
    totalClicksLost,
    decayingUrls: decaying.length,
    strikingDistance: striking.length,
    estimatedRevenueAtRisk: Math.round(estimatedRevenueAtRisk),
    estimatedRevenueOpportunity: Math.round(estimatedRevenueOpportunity),
  };
}

export function filterRows(
  rows: RevenueRescueRow[],
  opts: {
    segment: Segment;
    dateMode: DateMode;
    search: string;
    pathFilter: string;
    facetFilter?: string;
  }
): RevenueRescueRow[] {
  const q = opts.search.trim().toLowerCase();
  const path = opts.pathFilter === 'all' ? '' : opts.pathFilter.toLowerCase();
  const facet = opts.facetFilter?.trim() || 'all';

  return rows.filter((row) => {
    if (row.segment !== opts.segment) return false;
    if (path && !row.path.toLowerCase().startsWith(path)) return false;

    if (facet !== 'all') {
      if (opts.segment === 'content-decay') {
        if (row.diagnosis !== facet) return false;
      } else if (!row.optimizationGaps.includes(facet as never)) {
        return false;
      }
    }

    if (!q) return true;
    return (
      row.canonicalUrl.toLowerCase().includes(q) ||
      row.targetKeyword.toLowerCase().includes(q) ||
      row.path.toLowerCase().includes(q) ||
      row.silo.toLowerCase().includes(q) ||
      row.variants.some((v) => v.keyword.toLowerCase().includes(q))
    );
  });
}

export function sortRows(
  rows: RevenueRescueRow[],
  field: SortField,
  direction: SortDirection,
  segment: Segment
): RevenueRescueRow[] {
  const resolvedField: SortField =
    segment === 'striking-distance' &&
    (field === 'clicks' || field === 'delta' || field === 'diagnosis' || field === 'revenue')
      ? 'rank'
      : segment === 'content-decay' &&
          (field === 'rank' ||
            field === 'volume' ||
            field === 'trafficGain' ||
            field === 'gap')
        ? 'delta'
        : field;

  const dir = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (resolvedField) {
      case 'page':
        cmp = a.path.localeCompare(b.path);
        break;
      case 'clicks':
        cmp = a.currentClicks - b.currentClicks;
        break;
      case 'delta':
        cmp = a.trafficDeltaPct - b.trafficDeltaPct;
        break;
      case 'diagnosis':
        cmp = a.diagnosis.localeCompare(b.diagnosis);
        break;
      case 'revenue':
        cmp = a.estimatedRevenueAtRisk - b.estimatedRevenueAtRisk;
        break;
      case 'rank':
        cmp = a.currentRank - b.currentRank;
        break;
      case 'volume':
        cmp = a.searchVolume - b.searchVolume;
        break;
      case 'trafficGain':
        cmp = a.estTrafficGain - b.estTrafficGain;
        break;
      case 'gap':
        cmp = (a.optimizationGaps[0] ?? '').localeCompare(
          b.optimizationGaps[0] ?? ''
        );
        break;
      default:
        cmp = 0;
    }
    return cmp * dir;
  });
}

export function groupRowsBySilo(
  rows: RevenueRescueRow[]
): { silo: string; rows: RevenueRescueRow[] }[] {
  const map = new Map<string, RevenueRescueRow[]>();
  for (const row of rows) {
    const list = map.get(row.silo) ?? [];
    list.push(row);
    map.set(row.silo, list);
  }
  return Array.from(map.entries())
    .map(([silo, groupRows]) => ({ silo, rows: groupRows }))
    .sort((a, b) => a.silo.localeCompare(b.silo));
}

export function uniquePaths(rows: RevenueRescueRow[]): string[] {
  const roots = new Set<string>();
  for (const row of rows) {
    const parts = row.path.split('/').filter(Boolean);
    if (parts[0]) roots.add(`/${parts[0]}`);
  }
  return Array.from(roots).sort();
}

export function formatClicks(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDeltaPct(n: number): string {
  const clamped = clampDeltaPct(n);
  const sign = clamped > 0 ? '+' : '';
  return `${sign}${clamped}%`;
}

export function formatVolume(n: number): string {
  return `${new Intl.NumberFormat('en-US').format(Math.round(n))}/mo`;
}

export function pathDisplay(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function applyDateModeScale(
  rows: RevenueRescueRow[],
  mode: DateMode
): RevenueRescueRow[] {
  if (mode === 'mom') return rows;
  // YoY: deeper historical drops, but keep peak > current and delta within [-100, 0]
  return rows.map((row) => {
    if (row.segment !== 'content-decay') {
      return {
        ...row,
        estTrafficGain: Math.round(row.estTrafficGain * 1.15),
      };
    }
    const amplifiedCurrent = Math.max(
      1,
      Math.min(row.peakClicks - 1, Math.round(row.currentClicks * 0.85))
    );
    const { trafficDelta, trafficDeltaPct } = deriveTrafficMetrics(
      row.peakClicks,
      amplifiedCurrent
    );
    const revenuePerClick =
      Math.abs(row.trafficDelta) > 0
        ? row.estimatedRevenueAtRisk / Math.abs(row.trafficDelta)
        : 0.96;
    return {
      ...row,
      currentClicks: amplifiedCurrent,
      trafficDelta,
      trafficDeltaPct,
      estimatedRevenueAtRisk: Math.round(Math.abs(trafficDelta) * revenuePerClick),
    };
  });
}

export type FlatTableItem =
  | { type: 'group'; silo: string; count: number; id: string }
  | { type: 'row'; row: RevenueRescueRow; id: string };

export function flattenForVirtual(
  rows: RevenueRescueRow[],
  viewMode: ViewMode
): FlatTableItem[] {
  if (viewMode === 'list') {
    return rows.map((row) => ({ type: 'row' as const, row, id: row.id }));
  }
  const groups = groupRowsBySilo(rows);
  const items: FlatTableItem[] = [];
  for (const g of groups) {
    items.push({
      type: 'group',
      silo: g.silo,
      count: g.rows.length,
      id: `group-${g.silo}`,
    });
    for (const row of g.rows) {
      items.push({ type: 'row', row, id: row.id });
    }
  }
  return items;
}

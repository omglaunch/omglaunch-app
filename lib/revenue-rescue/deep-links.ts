import { buildSiloBuilderHref } from '@/lib/silo-builder/deep-link';
import {
  REVENUE_RESCUE_PREFILL_KEY,
  type Diagnosis,
  type RevenueRescuePrefill,
  type RevenueRescueRow,
} from '@/lib/revenue-rescue/types';

export function storeRevenueRescuePrefill(prefill: RevenueRescuePrefill): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(REVENUE_RESCUE_PREFILL_KEY, JSON.stringify(prefill));
}

export function consumeRevenueRescuePrefill(): RevenueRescuePrefill | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(REVENUE_RESCUE_PREFILL_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(REVENUE_RESCUE_PREFILL_KEY);
  try {
    const parsed = JSON.parse(raw) as RevenueRescuePrefill;
    if (
      parsed?.source !== 'revenue-rescue' ||
      typeof parsed.targetKeyword !== 'string' ||
      typeof parsed.url !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function peekRevenueRescuePrefill(): RevenueRescuePrefill | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(REVENUE_RESCUE_PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RevenueRescuePrefill;
  } catch {
    return null;
  }
}

export function rowToPrefill(row: RevenueRescueRow): RevenueRescuePrefill {
  return {
    source: 'revenue-rescue',
    url: row.canonicalUrl,
    canonicalUrl: row.canonicalUrl,
    targetKeyword: row.targetKeyword,
    title: `${row.targetKeyword} — recovery brief`,
    diagnosis: row.diagnosis,
    metricDelta: row.trafficDelta,
    metricDeltaPct: row.trafficDeltaPct,
    engagementDeltaPct: row.engagementDeltaPct,
  };
}

export function primaryActionForDiagnosis(diagnosis: Diagnosis): {
  label: string;
  destination: 'optimizer' | 'studio' | 'silo';
} {
  if (diagnosis === 'Rank Drop' || diagnosis === 'Cannibalization Risk') {
    return { label: 'Optimize Page', destination: 'optimizer' };
  }
  return { label: 'Rewrite in Studio', destination: 'studio' };
}

const SILO_GAPS = new Set(['Weak Internal Links', 'Orphan Page']);

export function needsSiloRouting(row: RevenueRescueRow): boolean {
  return row.optimizationGaps.some((gap) => SILO_GAPS.has(gap));
}

/** Context-aware primary CTA for triage rows (segment + gaps + diagnosis). */
export function primaryActionForRow(
  row: RevenueRescueRow,
  segment: 'content-decay' | 'striking-distance' = row.segment
): {
  label: string;
  destination: 'optimizer' | 'studio' | 'silo';
} {
  if (segment === 'striking-distance' && needsSiloRouting(row)) {
    return { label: 'Build Silo Links', destination: 'silo' };
  }
  return primaryActionForDiagnosis(row.diagnosis);
}

export function buildOptimizerHref(prefill: RevenueRescuePrefill): string {
  const params = new URLSearchParams({
    source: 'revenue-rescue',
    url: prefill.url,
    targetKeyword: prefill.targetKeyword,
    diagnosis: prefill.diagnosis,
    metricDelta: String(prefill.metricDelta),
    metricDeltaPct: String(prefill.metricDeltaPct),
  });
  return `/page-optimizer?${params.toString()}`;
}

export function buildStudioHref(prefill: RevenueRescuePrefill): string {
  const params = new URLSearchParams({
    source: 'revenue-rescue',
    targetKeyword: prefill.targetKeyword,
    title: prefill.title,
    diagnosis: prefill.diagnosis,
    metricDelta: String(prefill.metricDelta),
    metricDeltaPct: String(prefill.metricDeltaPct),
  });
  return `/article-studio?${params.toString()}`;
}

export function buildSiloHref(row: RevenueRescueRow): string {
  return buildSiloBuilderHref({
    seed: row.targetKeyword,
    mode: 'quick',
  });
}

export function navigateWithPrefill(
  router: { push: (href: string) => void },
  row: RevenueRescueRow,
  destination: 'optimizer' | 'studio' | 'silo'
): void {
  const prefill = rowToPrefill(row);
  storeRevenueRescuePrefill(prefill);

  if (destination === 'optimizer') {
    router.push(buildOptimizerHref(prefill));
    return;
  }
  if (destination === 'studio') {
    router.push(buildStudioHref(prefill));
    return;
  }
  router.push(buildSiloHref(row));
}

export function bulkDestinationForRows(
  rows: RevenueRescueRow[]
): 'optimizer' | 'studio' | 'silo' {
  if (!rows.length) return 'optimizer';

  const counts = { optimizer: 0, studio: 0, silo: 0 };
  for (const row of rows) {
    counts[primaryActionForRow(row).destination] += 1;
  }

  if (counts.silo >= counts.studio && counts.silo >= counts.optimizer) {
    return 'silo';
  }
  return counts.studio > counts.optimizer ? 'studio' : 'optimizer';
}

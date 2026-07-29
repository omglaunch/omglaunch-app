'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import EditablePromptCell from './EditablePromptCell';
import PortalVirtualSelect from './PortalVirtualSelect';
import {
  selectStagingRows,
  toggleRowSelected,
  selectAllEligible,
  updateStagingRow,
  useOnboardingStore,
  getDefaultGeo,
} from '@/lib/ai-visibility/onboarding/store';
import {
  SOURCE_LABELS,
  type GeoTargetOption,
} from '@/lib/ai-visibility/onboarding/types';
import { hasBlockingErrors } from '@/lib/ai-visibility/onboarding/utils';
import { cn } from '@/lib/utils';

const TABLE_MIN_WIDTH = 1440;
const ROW_HEIGHT = 56;
const GRID =
  'grid-cols-[40px_minmax(320px,1.6fr)_100px_minmax(160px,1fr)_minmax(180px,1fr)]';

export default function StagingTable() {
  const parentRef = useRef<HTMLDivElement>(null);
  const selected = useOnboardingStore((s) => s.selected);
  const rows = useOnboardingStore((s) => selectStagingRows(s));

  const [clusterOptions, setClusterOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [geoOptions, setGeoOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const geoCache = useRef<Record<string, GeoTargetOption>>({});

  useEffect(() => {
    const clusters = Array.from(
      new Set(rows.map((r) => r.cluster).filter(Boolean))
    ).sort();
    setClusterOptions(clusters.map((c) => ({ value: c, label: c })));
  }, [rows]);

  const loadGeos = useCallback(async (q: string) => {
    setGeoLoading(true);
    try {
      const res = await fetch(
        `/api/ai-visibility/onboarding/locations?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { options: GeoTargetOption[] };
      for (const o of data.options) geoCache.current[o.locationId] = o;
      setGeoOptions(
        data.options.map((o) => ({ value: o.locationId, label: o.label }))
      );
    } finally {
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGeos('');
  }, [loadGeos]);

  const eligibleIds = rows.filter((r) => !hasBlockingErrors(r)).map((r) => r.id);
  const allEligibleSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selected.get(id));
  const someSelected = rows.some((r) => selected.get(r.id));

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-slate-50/80 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
        <p className="text-sm font-medium text-foreground">Staging is empty</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Discover, import from GSC, or upload a CSV — rows land here (max 100).
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div ref={parentRef} className="max-h-[min(48vh,520px)] overflow-auto">
        <div style={{ minWidth: TABLE_MIN_WIDTH }} className="relative">
          <div
            className={cn(
              'sticky top-0 z-20 grid gap-2 border-b border-zinc-200 bg-slate-50/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95',
              GRID
            )}
          >
            <div className="flex items-center">
              <Checkbox
                checked={
                  allEligibleSelected
                    ? true
                    : someSelected
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={(v) => selectAllEligible(v === true)}
                aria-label="Select all eligible"
              />
            </div>
            <div className="sticky left-0 z-30 -ml-3 bg-slate-50/95 pl-3 backdrop-blur dark:bg-zinc-950/95">
              Generated Prompt
            </div>
            <div>Source</div>
            <div>Target Cluster</div>
            <div>Geo Target</div>
          </div>

          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = rows[vRow.index]!;
              const err = hasBlockingErrors(row);
              return (
                <div
                  key={row.id}
                  className={cn(
                    'absolute left-0 top-0 grid w-full gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-900',
                    GRID,
                    err && 'bg-amber-50/40 dark:bg-amber-950/10'
                  )}
                  style={{
                    height: vRow.size,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  <div className="flex items-center">
                    <Checkbox
                      checked={Boolean(selected.get(row.id))}
                      onCheckedChange={() => toggleRowSelected(row.id)}
                      aria-label={`Select ${row.prompt}`}
                    />
                  </div>

                  <div className="sticky left-0 z-10 -ml-3 min-w-0 bg-white pl-3 dark:bg-zinc-950">
                    <EditablePromptCell
                      id={row.id}
                      value={row.prompt}
                      hasError={err}
                    />
                  </div>

                  <div className="flex items-center">
                    <Badge
                      variant="outline"
                      className="border-zinc-200 text-[10px] dark:border-zinc-700"
                    >
                      {SOURCE_LABELS[row.source]}
                    </Badge>
                  </div>

                  <div className="min-w-0">
                    <PortalVirtualSelect
                      value={row.cluster}
                      options={clusterOptions}
                      creatable
                      onChange={(v) => {
                        updateStagingRow(row.id, { cluster: v });
                        setClusterOptions((prev) =>
                          prev.some((o) => o.value === v)
                            ? prev
                            : [...prev, { value: v, label: v }].sort((a, b) =>
                                a.label.localeCompare(b.label)
                              )
                        );
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <PortalVirtualSelect
                      value={row.geo?.locationId ?? ''}
                      options={geoOptions}
                      loading={geoLoading}
                      onSearch={loadGeos}
                      onChange={(locationId) => {
                        const geo =
                          geoCache.current[locationId] ??
                          (locationId
                            ? {
                                locationId,
                                label:
                                  geoOptions.find((o) => o.value === locationId)
                                    ?.label ?? locationId,
                              }
                            : getDefaultGeo());
                        updateStagingRow(row.id, {
                          geo,
                          geoPending: false,
                        });
                      }}
                    />
                    {row.geoPending ? (
                      <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        Unresolved location — pick a Geo Target
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

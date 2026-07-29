'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { useProject } from '@/components/projects/ProjectProvider';
import AeoBrandSetupBanner from '@/components/ai-visibility/AeoBrandSetupBanner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PortalVirtualSelect from './PortalVirtualSelect';
import {
  bulkEditSelected,
  clearStagingTable,
  flushPendingPromptEdits,
  getSelectedRowsForCommit,
  selectEstimatedMonthlyCredits,
  selectHasSelectedErrors,
  selectSelectedActiveCount,
  selectSelectedCount,
  selectStagingRows,
  setOnboardingCommitting,
  useOnboardingStore,
} from '@/lib/ai-visibility/onboarding/store';
import type { GeoTargetOption } from '@/lib/ai-visibility/onboarding/types';
import type { VisibilityRow } from '@/lib/ai-visibility/types';
import { Z_INDEX } from '@/lib/ai-visibility/onboarding/z-index';
import { cn } from '@/lib/utils';

type Props = {
  onCommitted: (payload: {
    rows: VisibilityRow[];
    lastUpdatedAt: string;
    clusterIds: string[];
  }) => void;
  /** Bump to re-check brand profile after inline setup */
  brandCheckKey?: number;
};

export default function StagingActionBar({ onCommitted, brandCheckKey = 0 }: Props) {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const [brandReady, setBrandReady] = useState<boolean | null>(null);
  const rows = useOnboardingStore((s) => selectStagingRows(s));
  const selectedCount = useOnboardingStore((s) => selectSelectedCount(s));
  const selectedActive = useOnboardingStore((s) => selectSelectedActiveCount(s));
  const hasErrors = useOnboardingStore((s) => selectHasSelectedErrors(s));
  const estCredits = useOnboardingStore((s) => selectEstimatedMonthlyCredits(s));
  const isCommitting = useOnboardingStore((s) => s.isCommitting);
  const isBusy = useOnboardingStore((s) => s.isIngesting || s.isCommitting);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCluster, setBulkCluster] = useState('');
  const [bulkGeoId, setBulkGeoId] = useState('');
  const [geoOptions, setGeoOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const geoCache = useMemo(() => new Map<string, GeoTargetOption>(), []);

  useEffect(() => {
    if (!activeProjectId?.trim()) {
      setBrandReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(activeProjectId)}/aeo-brand`
        );
        if (!res.ok) throw new Error('brand check failed');
        const data = (await res.json()) as { profile?: unknown };
        if (!cancelled) setBrandReady(Boolean(data.profile));
      } catch {
        if (!cancelled) setBrandReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, brandCheckKey]);

  const commitDisabled =
    selectedActive === 0 || isBusy || hasErrors || !activeProjectId || brandReady === false;

  async function loadGeos(q: string) {
    const res = await fetch(
      `/api/ai-visibility/onboarding/locations?q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { options: GeoTargetOption[] };
    data.options.forEach((o) => geoCache.set(o.locationId, o));
    setGeoOptions(data.options.map((o) => ({ value: o.locationId, label: o.label })));
  }

  async function handleCommit() {
    flushPendingPromptEdits();
    const selected = getSelectedRowsForCommit();
    if (selected.length === 0) return;

    setOnboardingCommitting(true);
    try {
      if (!activeProjectId) {
        toast.error('Select a project before committing prompts.');
        return;
      }
      if (brandReady === false) {
        toast.error('Configure client brand profile before committing prompts.');
        return;
      }
      const res = await fetch('/api/ai-visibility/onboarding/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          prompts: selected.map((r) => ({
            id: r.id,
            prompt: r.prompt,
            cluster: r.cluster,
            geoLocationId: r.geo!.locationId,
            geoLabel: r.geo!.label,
            source: r.source,
          })),
        }),
      });
      const data = (await res.json()) as {
        created?: number;
        skippedDuplicates?: number;
        clusterIds?: string[];
        rows?: VisibilityRow[];
        lastUpdatedAt?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? 'Commit failed');
        return;
      }

      clearStagingTable();
      onCommitted({
        rows: data.rows ?? [],
        lastUpdatedAt: data.lastUpdatedAt ?? new Date().toISOString(),
        clusterIds: data.clusterIds ?? [],
      });

      const clusterQs = (data.clusterIds ?? []).join(',');
      toast.success(
        `Committed ${data.created ?? 0} prompts` +
          (data.skippedDuplicates
            ? ` (${data.skippedDuplicates} duplicates skipped)`
            : ''),
        {
          duration: 8000,
          action: {
            label: 'View in Visibility Matrix',
            onClick: () => {
              router.push(
                clusterQs
                  ? `/ai-visibility?clusters=${encodeURIComponent(clusterQs)}`
                  : '/ai-visibility'
              );
            },
          },
          description: 'Or run Gap Analysis from Article Studio.',
        }
      );

      // Dual-action secondary
      toast.message('Next step', {
        action: {
          label: 'Run Gap Analysis',
          onClick: () => {
            router.push(
              `/article-studio?clusters=${encodeURIComponent(clusterQs)}&sourceRoute=ai-visibility`
            );
          },
        },
      });
    } catch {
      toast.error('Commit failed');
    } finally {
      setOnboardingCommitting(false);
    }
  }

  function applyBulk() {
    const geo = bulkGeoId ? geoCache.get(bulkGeoId) ?? null : undefined;
    bulkEditSelected({
      cluster: bulkCluster.trim() || undefined,
      geo: geo === null ? undefined : geo,
    });
    setBulkOpen(false);
    toast.success('Bulk edit applied to eligible selected rows');
  }

  return (
    <>
      <div
        className="sticky bottom-0 flex flex-col gap-3 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:flex-row sm:items-center sm:justify-between"
        style={{ zIndex: Z_INDEX.actionBar }}
      >
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Selected: {selectedCount}/{rows.length} Prompts
          </span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <span>
            Est. Monthly Sync Cost:{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {estCredits.toLocaleString()} Credits
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-200 dark:border-zinc-800"
            disabled={commitDisabled}
            onClick={() => {
              void loadGeos('');
              setBulkOpen(true);
            }}
          >
            Bulk Edit Selected
          </Button>
          <Button
            size="sm"
            className={cn(
              'bg-emerald-600 text-white hover:bg-emerald-500',
              commitDisabled && 'opacity-50'
            )}
            disabled={commitDisabled}
            onClick={() => void handleCommit()}
          >
            {isCommitting ? 'Committing…' : 'Commit to Visibility Engine'}
          </Button>
        </div>
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="border-zinc-200 dark:border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Selected</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Target Cluster</Label>
              <Input
                value={bulkCluster}
                onChange={(e) => setBulkCluster(e.target.value)}
                placeholder="Leave blank to keep existing"
                className="border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Geo Target</Label>
              <PortalVirtualSelect
                value={bulkGeoId}
                options={geoOptions}
                onSearch={(q) => void loadGeos(q)}
                onChange={setBulkGeoId}
                placeholder="Leave blank to keep existing"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={applyBulk}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

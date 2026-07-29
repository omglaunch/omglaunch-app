'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Coins, Eye, Layers, RefreshCw, Settings2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

import AeoMatrixTable from '@/components/ai-visibility/AeoMatrixTable';
import CreditWarningModal from '@/components/ai-visibility/CreditWarningModal';
import PromptOnboardingEngine from '@/components/ai-visibility/onboarding/PromptOnboardingEngine';
import VisibilityFilters from '@/components/ai-visibility/VisibilityFilters';
import VisibilitySnapshotCards from '@/components/ai-visibility/VisibilitySnapshotCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  applySseRowPatch,
  getOrderedRows,
  mergeVisibilityRows,
  patchVisibilityRow,
  replaceVisibilityRows,
  useVisibilityStore,
} from '@/lib/ai-visibility/store';
import { subscribeVisibilitySse, useFocusReconcile } from '@/lib/ai-visibility/sse';
import type {
  ChatGptMode,
  EngineFilter,
  VisibilityFiltersState,
  VisibilityMatrixPage,
  VisibilitySnapshot,
} from '@/lib/ai-visibility/types';
import { RAG_ONLY_ENGINES } from '@/lib/ai-visibility/types';
import {
  filterVisibilityRows,
  readClientCache,
  uniqueClusters,
  uniqueGeos,
  writeClientCache,
} from '@/lib/ai-visibility/utils';
import { cn } from '@/lib/utils';
import AeoBrandSetupBanner from '@/components/ai-visibility/AeoBrandSetupBanner';
import ShareLinkDialog from '@/components/client-share/ShareLinkDialog';
import { useProject } from '@/components/projects/ProjectProvider';
import { useClientBrand } from '@/hooks/useClientBrand';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';

const DEFAULT_FILTERS: VisibilityFiltersState = {
  search: '',
  promptCluster: 'all',
  engine: 'all',
  device: 'desktop',
  chatGptMode: 'live_web',
  geoTarget: 'all',
  citationStatus: 'all',
};

export default function AiVisibilityClient() {
  const { activeProjectId, isLoading: projectsLoading, activeProject } = useProject();
  const { brandLabel } = useClientBrand();
  const { isViewer, canWrite, hideUsageMetricsFromViewer } = useTeamAccess();
  const [hydrated, setHydrated] = useState(false);
  const [snapshot, setSnapshot] = useState<VisibilitySnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [filters, setFilters] = useState<VisibilityFiltersState>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [deepScan, setDeepScan] = useState(false);
  const [baseKnowledgeFetched, setBaseKnowledgeFetched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fetchingRef = useRef(false);
  const lastUpdatedAtRef = useRef<string | null>(null);

  const storeHydrated = useVisibilityStore((s) => s.hydrated);
  const sortIndex = useVisibilityStore((s) => s.sortIndex);

  // Two-pass render — wait for client hydration before injecting UI that
  // depends on local timezone / localStorage to prevent SSR crashes.
  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (!activeProjectId) {
      setSnapshot(null);
      setSnapshotLoading(false);
      return;
    }
    setSnapshotLoading(true);
    try {
      const res = await fetch(
        `/api/ai-visibility/snapshot?projectId=${encodeURIComponent(activeProjectId)}`
      );
      if (!res.ok) throw new Error('snapshot failed');
      const data = (await res.json()) as { snapshot: VisibilitySnapshot };
      setSnapshot(data.snapshot);
      setDeepScan(data.snapshot.deepScanEnabled);
      lastUpdatedAtRef.current = data.snapshot.lastUpdatedAt;
    } catch {
      toast.error('Failed to load visibility snapshot');
    } finally {
      setSnapshotLoading(false);
    }
  }, [activeProjectId]);

  const loadMatrixPage = useCallback(
    async (opts?: { reset?: boolean; since?: string | null; force?: boolean }) => {
      if (!activeProjectId) {
        setMatrixLoading(false);
        setIsFetchingMore(false);
        return;
      }
      if (fetchingRef.current && !opts?.force) return;
      fetchingRef.current = true;
      const reset = opts?.reset ?? false;
      if (reset) {
        setMatrixLoading(true);
        setCursor(null);
      } else {
        setIsFetchingMore(true);
      }

      try {
        const params = new URLSearchParams();
        if (opts?.since) {
          params.set('since', opts.since);
        } else if (!reset && cursor) {
          params.set('cursor', cursor);
        }
        // Server filters applied for search-heavy fields; client still filters for UX snappiness
        params.set('promptCluster', filters.promptCluster);
        params.set('geoTarget', filters.geoTarget);
        params.set('citationStatus', filters.citationStatus);
        if (filters.search) params.set('search', filters.search);
        params.set('projectId', activeProjectId);

        const res = await fetch(`/api/ai-visibility/matrix?${params.toString()}`);
        if (!res.ok) throw new Error('matrix failed');
        const page = (await res.json()) as VisibilityMatrixPage;

        startTransition(() => {
          if (reset) {
            replaceVisibilityRows(page.rows, page.lastUpdatedAt);
          } else if (opts?.since) {
            // Delta reconcile — mutate by prompt_id, preserve sort
            mergeVisibilityRows(page.rows, page.lastUpdatedAt);
          } else {
            mergeVisibilityRows(page.rows, page.lastUpdatedAt);
          }
          setCursor(page.nextCursor);
          setHasMore(Boolean(page.nextCursor));
          lastUpdatedAtRef.current = page.lastUpdatedAt;
          writeClientCache(activeProjectId, getOrderedRows(), page.lastUpdatedAt);
        });
      } catch {
        toast.error('Failed to load AEO matrix');
      } finally {
        fetchingRef.current = false;
        setMatrixLoading(false);
        setIsFetchingMore(false);
      }
    },
    [
      activeProjectId,
      cursor,
      filters.citationStatus,
      filters.geoTarget,
      filters.promptCluster,
      filters.search,
    ]
  );

  // Initial boot + reload when active project changes
  useEffect(() => {
    if (!hydrated || projectsLoading) return;

    if (!activeProjectId) {
      replaceVisibilityRows([], new Date().toISOString());
      setSnapshot(null);
      setMatrixLoading(false);
      return;
    }

    void loadSnapshot();

    const cached = readClientCache(activeProjectId, null);
    if (cached?.length) {
      replaceVisibilityRows(cached, cached[0]?.updatedAt ?? new Date().toISOString());
      setMatrixLoading(false);
    } else {
      replaceVisibilityRows([], new Date().toISOString());
    }

    void loadMatrixPage({ reset: true, force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeProjectId, projectsLoading]);

  // Re-fetch when server-side filter facets change
  useEffect(() => {
    if (!hydrated || !storeHydrated) return;
    void loadMatrixPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.promptCluster,
    filters.geoTarget,
    filters.citationStatus,
  ]);

  // SSE live cell updates — sequence-gated, sort-frozen
  useEffect(() => {
    if (!hydrated) return;
    return subscribeVisibilitySse((ev) => {
      try {
        const payload = JSON.parse(ev.data) as {
          promptId: string;
          updatedAt: string;
          patch: Record<string, unknown>;
        };
        if (!payload?.promptId || !payload?.updatedAt) return;
        applySseRowPatch(payload.promptId, {
          ...(payload.patch as object),
          updatedAt: payload.updatedAt,
        });
      } catch {
        // ignore non-JSON heartbeats
      }
    });
  }, [hydrated]);

  // Focus reconcile delta
  useEffect(() => {
    if (!hydrated) return;
    return useFocusReconcile(() => {
      void loadMatrixPage({ since: lastUpdatedAtRef.current, reset: false });
      void loadSnapshot();
    });
  }, [hydrated, loadMatrixPage, loadSnapshot]);

  const orderedRows = useMemo(() => {
    // Touch sortIndex so we re-render when store updates without reshuffling on SSE
    void sortIndex;
    return getOrderedRows();
  }, [sortIndex, storeHydrated]);

  const filteredRows = useMemo(
    () => filterVisibilityRows(orderedRows, filters),
    [orderedRows, filters]
  );

  const clusters = useMemo(() => uniqueClusters(orderedRows), [orderedRows]);
  const geos = useMemo(() => uniqueGeos(orderedRows), [orderedRows]);

  function onFilterChange(patch: Partial<VisibilityFiltersState>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };

      // Mutual exclusion: RAG-only engine forces Live Web Search
      if (
        patch.engine &&
        RAG_ONLY_ENGINES.includes(patch.engine as (typeof RAG_ONLY_ENGINES)[number])
      ) {
        next.chatGptMode = 'live_web';
      }

      // Selecting RAG-only via engine toggle clears base knowledge
      if (patch.engine && patch.engine !== 'all' && patch.engine !== 'chatgpt' && patch.engine !== 'claude') {
        // google / perplexity with base knowledge already dims those cols
      }

      return next;
    });
  }

  function onChatGptModeAttempt(mode: ChatGptMode) {
    if (mode === 'base_knowledge' && !baseKnowledgeFetched) {
      setCreditModalOpen(true);
      return;
    }
    // If selecting live web while on RAG-only engine filter — fine
    setFilters((prev) => ({ ...prev, chatGptMode: mode }));
  }

  function confirmBaseKnowledge() {
    setBaseKnowledgeFetched(true);
    setCreditModalOpen(false);
    setFilters((prev) => ({ ...prev, chatGptMode: 'base_knowledge' }));
    // Force engine off of pure google/pplx-only? Spec: selecting RAG-only engine forces live web.
    // Inverse: base knowledge dims google/pplx columns.
    if (snapshot) {
      setSnapshot({
        ...snapshot,
        creditsUsed: snapshot.creditsUsed + 12,
      });
    }
    toast.success('Base Knowledge mode enabled', {
      description: '12 credits reserved for async RAG fetch',
    });
  }

  async function handleForceSync(promptId: string) {
    if (!activeProjectId) {
      toast.error('Select a client project before syncing');
      return;
    }
    patchVisibilityRow(promptId, { rowSyncState: 'background_syncing' });
    try {
      const res = await fetch('/api/ai-visibility/force-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, projectId: activeProjectId, deepScan }),
      });
      const data = (await res.json()) as {
        row?: (typeof orderedRows)[number];
        error?: string;
        message?: string;
        enginesMissingKey?: string[];
        enginesFailed?: string[];
        creditsCharged?: number;
      };
      if (!res.ok || !data.row) {
        throw new Error(data.error ?? 'force sync failed');
      }
      patchVisibilityRow(promptId, data.row);
      const missing = data.enginesMissingKey?.length
        ? ` · missing key: ${data.enginesMissingKey.join(', ')}`
        : '';
      const failed = data.enginesFailed?.length
        ? ` · failed: ${data.enginesFailed.join(', ')}`
        : '';
      toast.success('Force sync complete', {
        description:
          data.message ??
          `Live engines updated${missing}${failed}`,
      });
    } catch (err) {
      patchVisibilityRow(promptId, { rowSyncState: 'failed' });
      toast.error(
        err instanceof Error ? err.message : 'Force sync failed'
      );
    }
  }

  function refreshAll() {
    // Manual refresh — allowed to reshuffle sort index
    void loadSnapshot();
    void loadMatrixPage({ reset: true });
    toast.success('Visibility vault refreshed');
  }

  if (!hydrated || projectsLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            />
          ))}
        </div>
      </div>
    );
  }

  const syncLabel =
    snapshot?.syncStatus === 'synced'
      ? 'Synced'
      : snapshot?.syncStatus === 'syncing'
        ? 'Syncing'
        : snapshot?.syncStatus === 'stale'
          ? 'Stale'
          : 'Error';

  return (
    <div className="relative mx-auto w-full max-w-[1600px] space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Generative engine optimization
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <Eye className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            AI Visibility Engine
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Cross-engine citation matrix with cost-aware sync, competitor threat
            intelligence, and context-aware optimization routing.
            {brandLabel ? (
              <>
                {' '}
                <span className="text-foreground/80">
                  Client: {brandLabel}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                snapshotLoading || matrixLoading
                  ? 'animate-pulse bg-amber-400'
                  : 'bg-emerald-500'
              )}
            />
            <span className="font-medium">Sync Status</span>
            <span className="text-muted-foreground">{syncLabel}</span>
          </div>

          {(!isViewer || !hideUsageMetricsFromViewer) ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-zinc-200 bg-white px-2.5 py-1 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <Coins className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Credits{' '}
              {snapshot
                ? `${snapshot.creditsUsed.toLocaleString()} / ${snapshot.creditsLimit.toLocaleString()}`
                : '—'}
            </Badge>
          ) : null}

          {canWrite ? (
            <Button
              size="sm"
              className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => setOnboardingOpen(true)}
            >
              <Layers className="h-4 w-4" />
              Seed Workspace
            </Button>
          ) : null}

          {canWrite ? (
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 border-zinc-200 dark:border-zinc-800"
              onClick={() => setSettingsOpen(true)}
              aria-label="API Cost Control"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          ) : null}

          {canWrite && activeProjectId ? (
            <ShareLinkDialog
              projectId={activeProjectId}
              reportType="ai_visibility"
              triggerLabel="Share summary"
            />
          ) : null}

          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 border-zinc-200 dark:border-zinc-800"
            onClick={refreshAll}
            disabled={snapshotLoading || isPending}
            aria-label="Refresh visibility vault"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                (snapshotLoading || isPending) && 'animate-spin'
              )}
            />
          </Button>
        </div>
      </div>

      {!activeProjectId ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950">
          Select or create a project to view AI visibility for a client brand.
        </div>
      ) : (
        <>
          <AeoBrandSetupBanner projectId={activeProjectId} />

      <VisibilitySnapshotCards snapshot={snapshot} loading={snapshotLoading} />

      <VisibilityFilters
        filters={filters}
        clusters={clusters}
        geos={geos}
        onChange={onFilterChange}
        onChatGptModeAttempt={onChatGptModeAttempt}
        ragDimmed={filters.chatGptMode === 'base_knowledge'}
      />

      {matrixLoading && filteredRows.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-3"
              >
                <div className="h-16 flex-1 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AeoMatrixTable
          rows={filteredRows}
          engineFilter={filters.engine as EngineFilter}
          chatGptMode={filters.chatGptMode}
          hasMore={hasMore}
          isFetchingMore={isFetchingMore}
          onLoadMore={() => {
            if (hasMore && !isFetchingMore) void loadMatrixPage({ reset: false });
          }}
          onForceSync={handleForceSync}
        />
      )}
        </>
      )}

      <CreditWarningModal
        open={creditModalOpen}
        onOpenChange={setCreditModalOpen}
        onConfirm={confirmBaseKnowledge}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="border-zinc-200 dark:border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Cost Control</DialogTitle>
            <DialogDescription>
              Toggle Deep Scan (Async AIOs) for richer Google AIO citation
              latency detection. Increases credit burn and runs asynchronously.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <Label htmlFor="deep-scan" className="text-sm">
              Deep Scan (Async AIOs)
            </Label>
            <Switch
              id="deep-scan"
              checked={deepScan}
              onCheckedChange={setDeepScan}
            />
          </div>
          <DialogFooter>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => {
                setSettingsOpen(false);
                toast.success(
                  deepScan ? 'Deep Scan enabled' : 'Deep Scan disabled'
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromptOnboardingEngine
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onCommitted={(payload) => {
          // Show committed rows immediately at top of matrix
          if (payload.rows.length > 0 && activeProjectId) {
            mergeVisibilityRows(payload.rows, payload.lastUpdatedAt, {
              prepend: true,
            });
            writeClientCache(activeProjectId, getOrderedRows(), payload.lastUpdatedAt);
            lastUpdatedAtRef.current = payload.lastUpdatedAt;
          }
          // Clear search so new rows aren't filtered out of view
          setFilters((prev) =>
            prev.search ? { ...prev, search: '' } : prev
          );
          void loadSnapshot();
          // Force reload; re-prepend after replace so commits stay visible on page 1
          void loadMatrixPage({ reset: true, force: true }).then(() => {
            if (payload.rows.length > 0 && activeProjectId) {
              mergeVisibilityRows(payload.rows, payload.lastUpdatedAt, {
                prepend: true,
              });
              writeClientCache(activeProjectId, getOrderedRows(), payload.lastUpdatedAt);
            }
          });
        }}
      />
    </div>
  );
}

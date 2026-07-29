'use client';

import { useEffect, useState } from 'react';
import { Layers, Trash2, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import DesktopPreferredOverlay from './DesktopPreferredOverlay';
import StagingActionBar from './StagingActionBar';
import StagingTable from './StagingTable';
import TabAutoDiscover from './TabAutoDiscover';
import TabCsvUpload from './TabCsvUpload';
import TabGscImport from './TabGscImport';
import AeoBrandSetupBanner from '@/components/ai-visibility/AeoBrandSetupBanner';
import { useProject } from '@/components/projects/ProjectProvider';
import {
  clearCapacityAlert,
  clearStagingTable,
  getOnboardingSnapshot,
  hydrateWorkspaceSettings,
  useOnboardingStore,
} from '@/lib/ai-visibility/onboarding/store';
import type { OnboardingTab } from '@/lib/ai-visibility/onboarding/types';
import { Z_INDEX } from '@/lib/ai-visibility/onboarding/z-index';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommitted?: (payload: {
    rows: import('@/lib/ai-visibility/types').VisibilityRow[];
    lastUpdatedAt: string;
    clusterIds: string[];
  }) => void;
};

/**
 * Prompt Onboarding Engine — Seed Workspace front door for AI Visibility.
 * Staging state sits above tab lifecycle (cross-tab unified append).
 */
export default function PromptOnboardingEngine({
  open,
  onOpenChange,
  onCommitted,
}: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<OnboardingTab>('auto-discover');
  const [isMobile, setIsMobile] = useState(false);
  const [brandRefreshKey, setBrandRefreshKey] = useState(0);
  const { activeProjectId } = useProject();

  const rowCount = useOnboardingStore((s) => s.order.length);
  const capacityAlert = useOnboardingStore((s) => s.lastCapacityAlert);
  const ceiling = useOnboardingStore((s) =>
    Math.min(100, s.remainingAccountLimit)
  );

  // Two-pass hydration + workspace settings
  useEffect(() => {
    if (!open) return;
    setHydrated(true);
    void (async () => {
      try {
        if (!activeProjectId) return;
        const res = await fetch(
          `/api/ai-visibility/onboarding/workspace?projectId=${encodeURIComponent(activeProjectId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          settings: Parameters<typeof hydrateWorkspaceSettings>[0];
        };
        hydrateWorkspaceSettings(data.settings);
      } catch {
        /* soft-fail — store has defaults */
      }
    })();
  }, [open, activeProjectId]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [open]);

  // beforeunload when staging > 0
  useEffect(() => {
    if (!open) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (getOnboardingSnapshot().order.length === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [open, rowCount]);

  useEffect(() => {
    if (capacityAlert) {
      toast.error(capacityAlert);
      clearCapacityAlert();
    }
  }, [capacityAlert]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-stretch justify-center bg-black/50 p-0 sm:p-4"
      style={{ zIndex: Z_INDEX.stagingModal }}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt Onboarding Engine"
    >
      <div className="relative flex h-full w-full max-w-[1400px] flex-col overflow-hidden bg-slate-50 shadow-2xl dark:bg-[#0a0a0a] sm:h-[min(92vh,900px)] sm:rounded-xl sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
        {!hydrated ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ) : (
          <>
            <DesktopPreferredOverlay active={isMobile} />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Seed Workspace
                </p>
                <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
                  <Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Prompt Onboarding Engine
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mandatory front door before prompts enter the Visibility
                  Matrix · Staging {rowCount}/{ceiling}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    clearStagingTable();
                    toast.message('Staging cleared');
                  }}
                  disabled={rowCount === 0}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear Staging / Discard All
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 border-zinc-200 dark:border-zinc-800"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                {activeProjectId ? (
                  <AeoBrandSetupBanner
                    projectId={activeProjectId}
                    variant="inline"
                    onProfileSaved={() => setBrandRefreshKey((k) => k + 1)}
                  />
                ) : null}
                <ToggleGroup
                  type="single"
                  value={tab}
                  onValueChange={(v) => {
                    if (v) setTab(v as OnboardingTab);
                  }}
                  className="h-auto flex-wrap justify-start gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {(
                    [
                      ['auto-discover', '1. Auto-Discover (AI Crawler)'],
                      ['gsc-import', '2. GSC Import (AEO Translator)'],
                      ['bulk-upload', '3. Bulk Upload (CSV)'],
                    ] as const
                  ).map(([value, label]) => (
                    <ToggleGroupItem
                      key={value}
                      value={value}
                      className={cn(
                        'h-9 rounded-md px-3 text-xs data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-700 dark:data-[state=on]:bg-emerald-950/50 dark:data-[state=on]:text-emerald-300'
                      )}
                    >
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>

                <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
                  {tab === 'auto-discover' ? (
                    <TabAutoDiscover onBrandProfileUpdated={() => setBrandRefreshKey(k => k + 1)} />
                  ) : null}
                  {tab === 'gsc-import' ? (
                    <TabGscImport onBrandProfileUpdated={() => setBrandRefreshKey(k => k + 1)} />
                  ) : null}
                  {tab === 'bulk-upload' ? <TabCsvUpload /> : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Staging & Approval
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      Cross-tab unified append · horizontal scroll &lt;1440px
                    </span>
                  </div>
                  <StagingTable />
                </div>
              </div>

              <StagingActionBar
                brandCheckKey={brandRefreshKey}
                onCommitted={(payload) => {
                  onCommitted?.(payload);
                  onOpenChange(false);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

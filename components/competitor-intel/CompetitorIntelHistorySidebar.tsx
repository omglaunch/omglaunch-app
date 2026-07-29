'use client';

import { format } from 'date-fns';
import { Crosshair, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CompetitorIntelSummary } from '@/lib/competitor-intel/persistence';
import { cn } from '@/lib/utils';

type CompetitorIntelHistorySidebarProps = {
  runs: CompetitorIntelSummary[];
  activeRunId: string | null;
  isLoading: boolean;
  isLoadingRun: boolean;
  deletingId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
};

function runLabel(run: CompetitorIntelSummary): string {
  if (run.competitorDomain) {
    return run.competitorDomain;
  }
  return run.coreNiche ?? 'Competitor run';
}

function runMeta(run: CompetitorIntelSummary): string {
  const parts = [run.targetCountry, format(new Date(run.createdAt), 'MMM d, yyyy')];
  if (run.keywordsAnalyzed != null) {
    parts.unshift(`${run.keywordsAnalyzed} keywords`);
  }
  return parts.join(' · ');
}

export default function CompetitorIntelHistorySidebar({
  runs,
  activeRunId,
  isLoading,
  isLoadingRun,
  deletingId,
  onSelect,
  onDelete,
}: CompetitorIntelHistorySidebarProps) {
  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm lg:w-1/4 lg:max-w-xs">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Saved Reports</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{runs.length} attack maps stored</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/60 px-3 py-8 text-center">
            <Crosshair className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">No saved reports yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reverse-engineer a competitor to save your first attack map.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {runs.map(run => {
              const isActive = run.id === activeRunId;

              return (
                <li key={run.id}>
                  <div
                    className={cn(
                      'group flex items-start gap-1 rounded-lg border transition-all',
                      isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-100'
                        : 'border-transparent hover:border-border hover:bg-muted'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(run.id)}
                      disabled={isLoadingRun && activeRunId === run.id}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1"
                    >
                      <p
                        className={cn(
                          'truncate text-sm font-medium',
                          isActive
                            ? 'text-emerald-900 dark:text-emerald-400'
                            : 'text-foreground'
                        )}
                      >
                        {runLabel(run)}
                      </p>
                      {run.coreNiche && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {run.coreNiche}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{runMeta(run)}</p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mr-1 mt-1.5 h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      disabled={deletingId === run.id}
                      onClick={event => onDelete(run.id, event)}
                      aria-label={`Delete ${runLabel(run)}`}
                    >
                      {deletingId === run.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

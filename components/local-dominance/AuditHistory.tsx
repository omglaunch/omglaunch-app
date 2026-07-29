'use client';

import { ChevronLeft, ChevronRight, History, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type AuditHistoryItem = {
  id: string;
  shareToken: string;
  keyword: string;
  gridSize: number;
  platform: string;
  solvScore: number | null;
  saivScore: number | null;
  createdAt: string;
};

type AuditHistoryProps = {
  audits: AuditHistoryItem[];
  selectedId?: string;
  loadingId?: string | null;
  deletingId?: string | null;
  onSelect: (audit: AuditHistoryItem) => void;
  onDelete?: (audit: AuditHistoryItem) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function AuditList({
  audits,
  selectedId,
  loadingId,
  deletingId,
  onSelect,
  onDelete,
}: Omit<AuditHistoryProps, 'collapsed' | 'onToggleCollapse'>) {
  if (audits.length === 0) {
    return (
      <p className="px-2 py-4 text-xs text-zinc-500 dark:text-slate-500">
        No audits yet. Run your first geogrid.
      </p>
    );
  }

  return (
    <>
      {audits.map(audit => {
        const isSelected = selectedId === audit.id;
        const isLoading = loadingId === audit.id;
        const isDeleting = deletingId === audit.id;

        return (
          <div key={audit.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(audit)}
              disabled={isDeleting || isLoading}
              className={cn(
                'w-full rounded-md px-3 py-2.5 pr-9 text-left transition-colors',
                isSelected
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-transparent dark:bg-blue-600/20 dark:text-blue-300'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-slate-800',
                (isDeleting || isLoading) && 'opacity-60'
              )}
            >
              <p className="truncate text-sm font-medium">{audit.keyword}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-slate-500">
                <span>
                  {audit.gridSize}×{audit.gridSize}
                </span>
                <span aria-hidden>·</span>
                <span className="capitalize">{audit.platform}</span>
                {isLoading ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading
                    </span>
                  </>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400">
                  SoLV {audit.solvScore ?? '—'}%
                </span>
                <span className="text-cyan-600 dark:text-cyan-400">
                  SAIV {audit.saivScore ?? '—'}%
                </span>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400 dark:text-slate-600">
                {new Date(audit.createdAt).toLocaleDateString()}
              </p>
            </button>

            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onDelete?.(audit);
              }}
              disabled={!onDelete || isDeleting || isLoading}
              className={cn(
                'absolute right-1 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors dark:text-slate-500',
                'opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 dark:hover:bg-red-950/50 dark:hover:text-red-400 dark:focus-visible:ring-red-900',
                'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                isSelected && 'sm:opacity-100',
                isDeleting && 'cursor-wait opacity-100',
                !onDelete && 'hidden'
              )}
              aria-label={`Delete audit for ${audit.keyword}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </>
  );
}

export default function AuditHistory({
  audits,
  selectedId,
  loadingId = null,
  deletingId = null,
  onSelect,
  onDelete,
  collapsed,
  onToggleCollapse,
}: AuditHistoryProps) {
  if (collapsed) {
    return (
      <>
        <div className="hidden w-10 shrink-0 flex-col items-center border-l border-zinc-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-950 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="text-zinc-500 hover:text-zinc-900 dark:text-slate-400 dark:hover:text-slate-100"
            aria-label="Expand audit history"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <History className="mt-4 h-4 w-4 text-zinc-400 dark:text-slate-500" />
        </div>

        <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <Button
            variant="ghost"
            onClick={onToggleCollapse}
            className="h-auto w-full justify-between px-2 py-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4" />
              Audit History
            </span>
            {audits.length > 0 ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500 dark:bg-slate-800 dark:text-slate-400">
                {audits.length}
              </span>
            ) : null}
          </Button>
        </div>
      </>
    );
  }

  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col border-t border-zinc-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:min-h-0 lg:w-64 lg:border-l lg:border-t-0 lg:overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-slate-200">
          <History className="h-4 w-4 shrink-0" />
          <span className="truncate">Audit History</span>
          {audits.length > 0 ? (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500 dark:bg-slate-800 dark:text-slate-400">
              {audits.length}
            </span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-7 w-7 shrink-0 text-zinc-500 hover:text-zinc-900 dark:text-slate-400 dark:hover:text-slate-100"
          aria-label="Collapse audit history"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="max-h-[min(40vh,320px)] lg:max-h-none lg:flex-1">
        <div className="space-y-1 p-2">
          <AuditList
            audits={audits}
            selectedId={selectedId}
            loadingId={loadingId}
            deletingId={deletingId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

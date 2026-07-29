'use client';

import { format } from 'date-fns';
import { History, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ToolHistorySummary } from '@/lib/tool-history/types';
import { cn } from '@/lib/utils';

type ToolHistoryPanelProps = {
  title?: string;
  description?: string;
  entries: ToolHistorySummary[];
  activeId?: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  onLoad: (entry: ToolHistorySummary) => void;
  onDelete: (id: string) => void;
  renderSubtitle?: (entry: ToolHistorySummary) => string | null;
  renderMetadata?: (entry: ToolHistorySummary) => ReactNode;
};

export default function ToolHistoryPanel({
  title = 'Recent History',
  description = 'Saved to your workspace — reload without re-running analysis.',
  entries,
  activeId = null,
  isLoading = false,
  emptyMessage = 'Completed runs will appear here for quick reload.',
  onLoad,
  onDelete,
  renderSubtitle,
  renderMetadata,
}: ToolHistoryPanelProps) {
  const showScrollFade = entries.length > 3;

  return (
    <Card className="flex h-full flex-col border-border shadow-sm">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              {!isLoading && entries.length > 0 ? (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {entries.length}
                </span>
              ) : null}
            </div>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 pb-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="relative">
            <ul
              className={cn(
                'max-h-[calc(100vh-200px)] space-y-1.5 overflow-y-auto pr-1',
                showScrollFade && 'pb-2'
              )}
              aria-label={`${title} list`}
            >
              {entries.map(entry => {
                const isActive = entry.id === activeId;
                const label = entry.identifier.trim() || 'Untitled entry';
                const savedDate = format(new Date(entry.createdAt), 'MMM d, yyyy · h:mm a');
                const subtitle = renderSubtitle?.(entry);
                const metadata = renderMetadata?.(entry);

                return (
                  <li key={entry.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onLoad(entry)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 pr-9 text-left transition-colors',
                        isActive
                          ? 'border-emerald-200 bg-emerald-50 shadow-sm hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-950'
                          : 'border-border bg-card hover:border-border hover:bg-muted/50'
                      )}
                    >
                      <p className="truncate text-sm font-medium leading-snug text-foreground">
                        {label}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {savedDate}
                      </p>
                      {subtitle ? (
                        <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
                          {subtitle}
                        </p>
                      ) : null}
                      {metadata ? <div className="mt-1.5 flex flex-wrap gap-1">{metadata}</div> : null}
                    </button>

                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        onDelete(entry.id);
                      }}
                      className={cn(
                        'absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
                        'opacity-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 dark:focus-visible:ring-red-900',
                        'group-hover:opacity-100',
                        isActive && 'opacity-100'
                      )}
                      aria-label={`Delete history entry for ${label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {showScrollFade ? (
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

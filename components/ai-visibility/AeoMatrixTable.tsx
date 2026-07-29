'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import PersistenceTrend from '@/components/ai-visibility/PersistenceTrend';
import CompetitorThreatCell from '@/components/ai-visibility/CompetitorThreatCell';
import OptimizationActionCell from '@/components/ai-visibility/OptimizationActionCell';
import {
  GoogleAioCell,
  LlmEngineCell,
  PerplexityCell,
} from '@/components/ai-visibility/EngineCitationCells';
import type {
  EngineFilter,
  VisibilityRow,
} from '@/lib/ai-visibility/types';
import {
  formatAiSearchVol,
  formatLocalSyncStamp,
  formatOrganicRank,
} from '@/lib/ai-visibility/utils';
import { applyRagOnlyMask } from '@/lib/ai-visibility/citation-eval';
import type { ChatGptMode } from '@/lib/ai-visibility/types';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 108;

/** Min table width enforces horizontal scroll under 1440px viewports */
const TABLE_MIN_WIDTH = 1440;

const GRID =
  'grid-cols-[minmax(280px,1.4fr)_minmax(150px,0.85fr)_minmax(120px,0.7fr)_minmax(160px,0.9fr)_minmax(180px,1fr)_minmax(200px,1.05fr)]';

type Props = {
  rows: VisibilityRow[];
  engineFilter: EngineFilter;
  chatGptMode: ChatGptMode;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  onForceSync: (promptId: string) => void;
};

function colVisible(engine: EngineFilter, col: EngineFilter | 'prompt' | 'threat' | 'action') {
  if (engine === 'all') return true;
  if (col === 'prompt' || col === 'threat' || col === 'action') return true;
  return engine === col;
}

export default function AeoMatrixTable({
  rows,
  engineFilter,
  chatGptMode,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onForceSync,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ragDim = chatGptMode === 'base_knowledge';

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div
        ref={parentRef}
        className="max-h-[min(70vh,820px)] overflow-auto"
        onScroll={() => {
          const el = parentRef.current;
          if (!el || !hasMore || isFetchingMore) return;
          const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
          if (remaining < 480) onLoadMore();
        }}
      >
        <div style={{ minWidth: TABLE_MIN_WIDTH }} className="relative">
          {/* Sticky header */}
          <div
            className={cn(
              'sticky top-0 z-20 grid gap-2 border-b border-zinc-200 bg-slate-50/95 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95',
              GRID
            )}
          >
            <div className="sticky left-0 z-30 -ml-3 bg-slate-50/95 pl-3 backdrop-blur dark:bg-zinc-950/95">
              Prompt, Demand & Context
            </div>
            {colVisible(engineFilter, 'google_aio') ? <div>Google AIO</div> : <div />}
            {colVisible(engineFilter, 'perplexity') ? <div>Perplexity</div> : <div />}
            {colVisible(engineFilter, 'chatgpt') || colVisible(engineFilter, 'claude') ? (
              <div>
                {engineFilter === 'claude'
                  ? 'Claude'
                  : engineFilter === 'chatgpt'
                    ? 'ChatGPT'
                    : 'ChatGPT / Claude'}
              </div>
            ) : (
              <div />
            )}
            <div>Competitor Threat</div>
            <div>Optimization Action</div>
          </div>

          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {items.map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              return (
                <div
                  key={row.promptId}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    'absolute left-0 top-0 grid w-full gap-2 border-b border-zinc-100 px-3 py-3 dark:border-zinc-900',
                    GRID
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {/* Frozen col 1 */}
                  <div className="sticky left-0 z-10 -ml-3 min-w-0 bg-white pl-3 dark:bg-zinc-950">
                    <PromptContextCell row={row} />
                  </div>

                  <div className="flex items-start">
                    {colVisible(engineFilter, 'google_aio') ? (
                      <GoogleAioCell
                        citation={applyRagOnlyMask(row.googleAio, chatGptMode) as typeof row.googleAio}
                        dimmed={ragDim}
                      />
                    ) : null}
                  </div>

                  <div className="flex items-start">
                    {colVisible(engineFilter, 'perplexity') ? (
                      <PerplexityCell
                        citation={
                          applyRagOnlyMask(row.perplexity, chatGptMode) as typeof row.perplexity
                        }
                        dimmed={ragDim}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    {(engineFilter === 'all' || engineFilter === 'chatgpt') && (
                      <LlmEngineCell citation={row.chatgpt} />
                    )}
                    {(engineFilter === 'all' || engineFilter === 'claude') && (
                      <LlmEngineCell citation={row.claude} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <CompetitorThreatCell threat={row.competitorThreat} />
                  </div>

                  <div className="min-w-0">
                    <OptimizationActionCell
                      row={row}
                      onForceSync={onForceSync}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {isFetchingMore ? (
            <div className="border-t border-zinc-200 px-3 py-3 text-center text-xs text-muted-foreground dark:border-zinc-800">
              Loading more prompts…
            </div>
          ) : null}
          {!hasMore && rows.length > 0 ? (
            <div className="border-t border-zinc-200 px-3 py-2 text-center text-[11px] text-muted-foreground dark:border-zinc-800">
              End of matrix · {rows.length.toLocaleString()} prompts
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PromptContextCell({ row }: { row: VisibilityRow }) {
  return (
    <div className="min-w-0 pr-2">
      <div className="block w-full min-w-0 text-left">
        <p
          className="truncate text-sm font-medium text-foreground"
          title={row.prompt}
        >
          {row.prompt}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            {row.promptCluster}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            AI Search Vol: {formatAiSearchVol(row.aiSearchVol)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Organic Rank: {formatOrganicRank(row.organicRank)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            📍 {row.geoTarget}
          </span>
        </div>
        <PersistenceTrend dots={row.persistenceTrend} />
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Synced {formatLocalSyncStamp(row.lastSyncedAt, row.geoTimezone)}
        </p>
      </div>
    </div>
  );
}

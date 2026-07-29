'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  ExternalLink,
  Link2,
  PenTool,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

import TrendSparkline from '@/components/revenue-rescue/TrendSparkline';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  navigateWithPrefill,
  primaryActionForRow,
} from '@/lib/revenue-rescue/deep-links';
import type { FlatTableItem } from '@/lib/revenue-rescue/utils';
import {
  formatClicks,
  formatCurrency,
  formatDeltaPct,
  formatVolume,
  pathDisplay,
} from '@/lib/revenue-rescue/utils';
import type {
  Diagnosis,
  Segment,
  SortDirection,
  SortField,
  RevenueRescueRow,
} from '@/lib/revenue-rescue/types';
import { ASSIGNEES } from '@/lib/revenue-rescue/mock-data';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 88;
const GROUP_HEIGHT = 40;

const DIAGNOSIS_STYLES: Record<Diagnosis, string> = {
  'Rank Drop':
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'CTR Decay':
    'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Cannibalization Risk':
    'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Intent Pivot':
    'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  'AI Overview Interference':
    'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
};

const GAP_STYLES =
  'border-zinc-300/80 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';

const DECAY_GRID =
  'md:grid-cols-[40px_minmax(180px,1.35fr)_140px_110px_108px_minmax(140px,1fr)_minmax(170px,1.05fr)_40px]';
const STRIKING_GRID =
  'md:grid-cols-[40px_minmax(180px,1.35fr)_88px_110px_120px_minmax(140px,1fr)_minmax(170px,1.05fr)_40px]';

type Props = {
  items: FlatTableItem[];
  segment: Segment;
  selectedIds: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onUpdateRow: (id: string, patch: Partial<RevenueRescueRow>) => void;
};

export default function TriageTable({
  items,
  segment,
  selectedIds,
  sortField,
  sortDirection,
  onSort,
  onToggle,
  onToggleAll,
  onUpdateRow,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowItems = items.filter((i) => i.type === 'row');
  const allSelected =
    rowItems.length > 0 && rowItems.every((i) => selectedIds.has(i.id));
  const someSelected = rowItems.some((i) => selectedIds.has(i.id));
  const isDecay = segment === 'content-decay';

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (items[index]?.type === 'group') return GROUP_HEIGHT;
      if (typeof window !== 'undefined' && window.innerWidth < 768) return 240;
      return ROW_HEIGHT;
    },
    overscan: 12,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={cn(
          'hidden border-b border-zinc-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-950/80 md:grid md:gap-2 md:px-3 md:py-2.5',
          isDecay ? DECAY_GRID : STRIKING_GRID
        )}
      >
        <div className="flex items-center">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(v) =>
              onToggleAll(
                rowItems.map((i) => i.id),
                v === true
              )
            }
            aria-label="Select all"
          />
        </div>
        <SortableHead
          label="Page & Keyword"
          field="page"
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={onSort}
        />
        {isDecay ? (
          <>
            <HeaderCell>90-Day Trend</HeaderCell>
            <SortableHead
              label="Clicks"
              field="clicks"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHead
              label="Delta"
              field="delta"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHead
              label="AI Diagnosis"
              field="diagnosis"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
          </>
        ) : (
          <>
            <SortableHead
              label="Current Rank"
              field="rank"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHead
              label="Search Volume"
              field="volume"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHead
              label="Est. Traffic Gain"
              field="trafficGain"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <SortableHead
              label="Optimization Gap"
              field="gap"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
          </>
        )}
        <HeaderCell>Status / Action</HeaderCell>
        <span className="sr-only">Assignee</span>
      </div>

      <div
        ref={parentRef}
        className="h-[min(68vh,720px)] overflow-auto overscroll-contain"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const item = items[vRow.index]!;
            return (
              <div
                key={item.id}
                data-index={vRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${vRow.start}px)` }}
              >
                {item.type === 'group' ? (
                  <div className="flex h-10 items-center gap-2 border-b border-zinc-200 bg-slate-100/80 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                    <span className="truncate">{item.silo}</span>
                    <Badge
                      variant="secondary"
                      className="font-normal tabular-nums"
                    >
                      {item.count}
                    </Badge>
                  </div>
                ) : (
                  <TriageRow
                    row={item.row}
                    segment={segment}
                    selected={selectedIds.has(item.row.id)}
                    onToggle={() => onToggle(item.row.id)}
                    onUpdateRow={onUpdateRow}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-foreground">No pages match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust segment, path, or search filters.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function SortableHead({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'inline-flex items-center gap-1 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground',
        active && 'text-foreground'
      )}
    >
      {label}
      {active ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="h-3 w-3 opacity-70" />
        ) : (
          <ArrowDown className="h-3 w-3 opacity-70" />
        )
      ) : (
        <ArrowDown className="h-3 w-3 opacity-25" />
      )}
    </button>
  );
}

function TriageRow({
  row,
  segment,
  selected,
  onToggle,
  onUpdateRow,
}: {
  row: RevenueRescueRow;
  segment: Segment;
  selected: boolean;
  onToggle: () => void;
  onUpdateRow: (id: string, patch: Partial<RevenueRescueRow>) => void;
}) {
  const router = useRouter();
  const [variantsOpen, setVariantsOpen] = useState(false);
  const primary = primaryActionForRow(row, segment);
  const variantCount = Math.max(0, row.variants.length - 1);
  const isDecay = segment === 'content-decay';
  const isMonitoring = row.status === 'monitoring' && row.monitoringDay != null;

  function runPrimary() {
    navigateWithPrefill(router, row, primary.destination);
    onUpdateRow(row.id, {
      status: 'monitoring',
      monitoringDay: 1,
      processedAt: new Date().toISOString(),
      fixDay: 89,
    });
    const messages = {
      optimizer: 'Opening Page Optimizer with diagnostic context',
      studio: 'Opening Article Studio with diagnostic context',
      silo: 'Opening Silo Builder to strengthen internal links',
    } as const;
    toast.success(messages[primary.destination]);
  }

  return (
    <div
      className={cn(
        'border-b border-zinc-200 px-3 py-3 transition-colors dark:border-zinc-800/80',
        selected
          ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
          : 'hover:bg-slate-50/80 dark:hover:bg-zinc-900/50',
        'md:grid md:items-center md:gap-2',
        isDecay ? DECAY_GRID : STRIKING_GRID
      )}
    >
      <div className="mb-2 flex items-start gap-3 md:mb-0 md:items-center">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${row.targetKeyword}`}
        />
        <div className="min-w-0 flex-1 md:hidden">
          <PageKeywordCell
            row={row}
            variantCount={variantCount}
            variantsOpen={variantsOpen}
            setVariantsOpen={setVariantsOpen}
          />
        </div>
      </div>

      <div className="hidden min-w-0 md:block">
        <PageKeywordCell
          row={row}
          variantCount={variantCount}
          variantsOpen={variantsOpen}
          setVariantsOpen={setVariantsOpen}
        />
      </div>

      {isDecay ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-3 md:mt-0 md:block">
            <span className="text-[10px] font-medium uppercase text-muted-foreground md:hidden">
              Trend
            </span>
            <TrendSparkline row={row} />
          </div>

          <div className="mt-3 md:mt-0">
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span className="text-sm font-semibold text-foreground">
                {formatClicks(row.currentClicks)}
              </span>
              <span className="text-xs text-muted-foreground">
                / {formatClicks(row.peakClicks)} peak
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              ↓ {Math.abs(row.engagementDeltaPct)}% Avg. Engagement Time
            </p>
          </div>

          <div className="mt-2 md:mt-0">
            <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-500">
              {formatDeltaPct(row.trafficDeltaPct)}
            </span>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {row.trafficDelta} clicks
            </p>
            <p className="mt-0.5 text-[11px] font-medium tabular-nums text-red-500/80">
              -{formatCurrency(row.estimatedRevenueAtRisk)}/mo
            </p>
          </div>

          <div className="mt-3 min-w-0 md:mt-0">
            {row.diagnosisLoading ? (
              <div className="space-y-1.5">
                <div className="h-5 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ) : (
              <>
                <Badge
                  variant="outline"
                  className={cn('font-medium', DIAGNOSIS_STYLES[row.diagnosis])}
                >
                  {row.diagnosis}
                </Badge>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  [{row.competitorContext}]
                </p>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 md:mt-0">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              #{row.currentRank}
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground md:hidden">
              Current rank
            </p>
          </div>

          <div className="mt-2 md:mt-0">
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatVolume(row.searchVolume)}
            </span>
          </div>

          <div className="mt-2 md:mt-0">
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{formatClicks(row.estTrafficGain)} clicks
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              (if moved to Top 3)
            </p>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap gap-1 md:mt-0">
            {row.optimizationGaps.map((gap) => (
              <Badge
                key={gap}
                variant="outline"
                className={cn('text-[10px] font-medium', GAP_STYLES)}
              >
                {gap}
              </Badge>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex min-w-0 flex-col gap-1.5 md:mt-0">
        <ActionCell
          row={row}
          isMonitoring={Boolean(isMonitoring)}
          primary={primary}
          onPrimary={runPrimary}
          onUpdateRow={onUpdateRow}
        />
      </div>

      <div className="mt-2 flex justify-end md:mt-0 md:justify-center">
        {row.assignee ? (
          <Avatar className="h-7 w-7 ring-2 ring-white dark:ring-zinc-950">
            <AvatarFallback
              className={cn(
                'text-[10px] font-semibold text-white',
                row.assignee.color
              )}
            >
              {row.assignee.initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="h-7 w-7" />
        )}
      </div>
    </div>
  );
}

function ActionCell({
  row,
  isMonitoring,
  primary,
  onPrimary,
  onUpdateRow,
}: {
  row: RevenueRescueRow;
  isMonitoring: boolean;
  primary: { label: string; destination: 'optimizer' | 'studio' | 'silo' };
  onPrimary: () => void;
  onUpdateRow: (id: string, patch: Partial<RevenueRescueRow>) => void;
}) {
  const router = useRouter();

  if (isMonitoring) {
    return (
      <div className="flex w-full items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-center text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
        ⏳ Monitoring Recovery: Day {row.monitoringDay}/28
      </div>
    );
  }

  if (row.status === 're-evaluation') {
    return (
      <div className="flex w-full items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-center text-[11px] font-medium text-amber-800 dark:text-amber-300">
        🟠 Re-Evaluation Required
      </div>
    );
  }

  if (row.status === 'seasonal') {
    return (
      <span className="inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-center text-xs font-medium text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        Marked seasonal
      </span>
    );
  }

  if (row.status === 'ignored') {
    return (
      <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-transparent px-2.5 py-1.5 text-center text-[11px] font-medium text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
        <Ban className="h-3 w-3 shrink-0 opacity-70" />
        Ignored
      </span>
    );
  }

  return (
    <div className="flex w-full items-stretch">
      <Button
        size="sm"
        className="h-8 min-w-0 flex-1 gap-1 rounded-r-none bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500"
        onClick={onPrimary}
      >
        {primary.destination === 'optimizer' ? (
          <Sparkles className="h-3 w-3 shrink-0" />
        ) : primary.destination === 'silo' ? (
          <Link2 className="h-3 w-3 shrink-0" />
        ) : (
          <PenTool className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{primary.label}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8 rounded-l-none border-l border-emerald-500/40 bg-emerald-600 px-2 text-white hover:bg-emerald-500"
            aria-label="More actions"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => {
              const next =
                ASSIGNEES[Math.floor(Math.random() * ASSIGNEES.length)]!;
              onUpdateRow(row.id, { assignee: next });
              toast.success(`Assigned to ${next.name}`);
            }}
          >
            <UserPlus className="mr-2 h-3.5 w-3.5" />
            Assign to Writer
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onUpdateRow(row.id, { status: 'seasonal' });
              toast.message('Marked as seasonal');
            }}
          >
            Mark as Seasonal
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onUpdateRow(row.id, { status: 'ignored' });
              toast.message('Ignored for this report');
            }}
          >
            Ignore
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigateWithPrefill(router, row, 'silo')}
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            View in Silo Builder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PageKeywordCell({
  row,
  variantCount,
  variantsOpen,
  setVariantsOpen,
}: {
  row: RevenueRescueRow;
  variantCount: number;
  variantsOpen: boolean;
  setVariantsOpen: (v: boolean) => void;
}) {
  return (
    <div className="min-w-0">
      <a
        href={row.canonicalUrl}
        target="_blank"
        rel="noreferrer"
        className="block truncate text-sm font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
        title={row.canonicalUrl}
      >
        {pathDisplay(row.canonicalUrl)}
      </a>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span className="truncate text-xs text-muted-foreground">
          {row.targetKeyword}
        </span>
        {variantCount > 0 ? (
          <Popover open={variantsOpen} onOpenChange={setVariantsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                +{variantCount} variants
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <p className="mb-2 text-xs font-semibold text-foreground">
                Normalized query variants
              </p>
              <ul className="max-h-48 space-y-1.5 overflow-auto">
                {row.variants.map((v) => (
                  <li
                    key={v.keyword}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {v.keyword}
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatClicks(v.clicks)}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}

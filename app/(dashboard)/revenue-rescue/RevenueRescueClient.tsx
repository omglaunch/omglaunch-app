'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Cloud,
  Crosshair,
  DollarSign,
  Link2Off,
  MousePointerClick,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

import BulkActionBar from '@/components/revenue-rescue/BulkActionBar';
import TriageTable from '@/components/revenue-rescue/TriageTable';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  bulkDestinationForRows,
  storeRevenueRescuePrefill,
  buildOptimizerHref,
  buildStudioHref,
  buildSiloHref,
  rowToPrefill,
} from '@/lib/revenue-rescue/deep-links';
import { generateRevenueRescueDataset } from '@/lib/revenue-rescue/mock-data';
import type {
  DateMode,
  RevenueRescueRow,
  Segment,
  SortDirection,
  SortField,
  ViewMode,
} from '@/lib/revenue-rescue/types';
import { DIAGNOSES, OPTIMIZATION_GAPS } from '@/lib/revenue-rescue/types';
import {
  applyDateModeScale,
  computeSummary,
  filterRows,
  flattenForVirtual,
  formatClicks,
  formatCurrency,
  loadAvgConversionValue,
  saveAvgConversionValue,
  sortRows,
  uniquePaths,
} from '@/lib/revenue-rescue/utils';
import { cn } from '@/lib/utils';

export default function RevenueRescueClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [avgValue, setAvgValue] = useState(48);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftAvg, setDraftAvg] = useState('48');
  const [segment, setSegment] = useState<Segment>('content-decay');
  const [dateMode, setDateMode] = useState<DateMode>('mom');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [pathFilter, setPathFilter] = useState('all');
  const [facetFilter, setFacetFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('delta');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [rows, setRows] = useState<RevenueRescueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [freshness, setFreshness] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const seg = params.get('segment');
    if (seg === 'striking-distance' || seg === 'content-decay') {
      setSegment(seg);
      if (seg === 'striking-distance') {
        setSortField('trafficGain');
        setSortDirection('desc');
      }
    }
  }, []);

  useEffect(() => {
    const value = loadAvgConversionValue();
    setAvgValue(value);
    setDraftAvg(String(value));

    const t = window.setTimeout(() => {
      startTransition(() => {
        const data = generateRevenueRescueDataset(5200, value);
        setRows(data);
        setFreshness(new Date());
        setIsLoading(false);
        window.setTimeout(() => {
          setRows((prev) =>
            prev.map((r) =>
              r.diagnosisLoading ? { ...r, diagnosisLoading: false } : r
            )
          );
        }, 1200);
      });
    }, 40);

    return () => window.clearTimeout(t);
  }, []);

  const scaledRows = useMemo(
    () => applyDateModeScale(rows, dateMode),
    [rows, dateMode]
  );

  const filtered = useMemo(() => {
    const base = filterRows(scaledRows, {
      segment,
      dateMode,
      search,
      pathFilter,
      facetFilter,
    });
    return sortRows(base, sortField, sortDirection, segment);
  }, [
    scaledRows,
    segment,
    dateMode,
    search,
    pathFilter,
    facetFilter,
    sortField,
    sortDirection,
  ]);

  const summary = useMemo(
    () => computeSummary(scaledRows, avgValue),
    [scaledRows, avgValue]
  );

  const paths = useMemo(() => uniquePaths(rows), [rows]);

  const flatItems = useMemo(
    () => flattenForVirtual(filtered, viewMode),
    [filtered, viewMode]
  );

  const selectedRows = useMemo(
    () => filtered.filter((r) => selectedIds.has(r.id)),
    [filtered, selectedIds]
  );

  const bulkDest = bulkDestinationForRows(selectedRows);
  const bulkLabel =
    bulkDest === 'optimizer'
      ? 'Optimizer'
      : bulkDest === 'silo'
        ? 'Silo Builder'
        : 'Studio';

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(
        field === 'rank' || field === 'page' || field === 'delta'
          ? 'asc'
          : 'desc'
      );
    }
  }

  function updateRow(id: string, patch: Partial<RevenueRescueRow>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function handleBulkSend() {
    if (selectedRows.length === 0) return;
    const first = selectedRows[0]!;
    storeRevenueRescuePrefill(rowToPrefill(first));
    // Mark selected as monitoring
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) =>
        selectedIds.has(r.id)
          ? {
              ...r,
              status: 'monitoring',
              monitoringDay: 1,
              processedAt: now,
              fixDay: 89,
            }
          : r
      )
    );
    if (bulkDest === 'optimizer') {
      router.push(buildOptimizerHref(rowToPrefill(first)));
    } else if (bulkDest === 'silo') {
      router.push(buildSiloHref(first));
    } else {
      router.push(buildStudioHref(rowToPrefill(first)));
    }
    toast.success(
      `Sending ${selectedRows.length} page${selectedRows.length === 1 ? '' : 's'} to ${bulkLabel}`
    );
    setSelectedIds(new Set());
  }

  function saveSettings() {
    const n = Number(draftAvg);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Enter a valid conversion value');
      return;
    }
    saveAvgConversionValue(n);
    setAvgValue(n);
    setSettingsOpen(false);
    toast.success('Average conversion value updated');
  }

  function refreshData() {
    setIsLoading(true);
    startTransition(() => {
      const data = generateRevenueRescueDataset(5200, avgValue);
      setRows(data);
      setFreshness(new Date());
      setSelectedIds(new Set());
      setIsLoading(false);
      toast.success('Report refreshed from BigQuery vault');
    });
  }

  const freshnessLabel = freshness
    ? `Updated ${freshness.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Syncing…';

  return (
    <div className="relative mx-auto w-full max-w-[1600px] space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Traffic reclamation
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Revenue Rescue Report
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Reclaim decaying and striking-distance pages. Actions deep-link into
            Page Optimizer, Article Studio, and Silo Builder with diagnosis
            context.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isLoading ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'
              )}
            />
            <span className="font-medium">Data Freshness</span>
            <span className="text-muted-foreground">{freshnessLabel}</span>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300"
          >
            <Cloud className="h-3.5 w-3.5" />
            BigQuery Vault Active
          </Badge>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 border-zinc-200 dark:border-zinc-800"
            onClick={() => {
              setDraftAvg(String(avgValue));
              setSettingsOpen(true);
            }}
            aria-label="Average Conversion Value settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 border-zinc-200 dark:border-zinc-800"
            onClick={refreshData}
            disabled={isLoading || isPending}
            aria-label="Refresh report"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                (isLoading || isPending) && 'animate-spin'
              )}
            />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Clicks Lost"
          value={isLoading ? '—' : formatClicks(summary.totalClicksLost)}
          icon={MousePointerClick}
          tone="rose"
          loading={isLoading}
        />
        <SummaryCard
          label="Decaying URLs"
          value={isLoading ? '—' : formatClicks(summary.decayingUrls)}
          icon={Link2Off}
          tone="amber"
          loading={isLoading}
        />
        <SummaryCard
          label="Striking Distance"
          value={isLoading ? '—' : formatClicks(summary.strikingDistance)}
          icon={Crosshair}
          tone="sky"
          loading={isLoading}
        />
        <SummaryCard
          label={
            segment === 'striking-distance'
              ? 'Est. Revenue Opportunity'
              : 'Estimated Revenue at Risk'
          }
          value={
            isLoading
              ? '—'
              : formatCurrency(
                  segment === 'striking-distance'
                    ? summary.estimatedRevenueOpportunity
                    : summary.estimatedRevenueAtRisk
                )
          }
          icon={segment === 'striking-distance' ? TrendingUp : DollarSign}
          tone={segment === 'striking-distance' ? 'emerald' : 'alert'}
          loading={isLoading}
          emphasize
        />
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Segmented
              value={segment}
              onChange={(v) => {
                const next = v as Segment;
                setSegment(next);
                setSelectedIds(new Set());
                setFacetFilter('all');
                if (next === 'striking-distance') {
                  // Avoid rank-asc clustering that makes every top row look like #11
                  setSortField('trafficGain');
                  setSortDirection('desc');
                } else {
                  setSortField('delta');
                  setSortDirection('asc');
                }
              }}
              options={[
                { value: 'content-decay', label: 'Content Decay' },
                { value: 'striking-distance', label: 'Striking Distance' },
              ]}
            />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {segment === 'content-decay' ? (
              <Segmented
                value={dateMode}
                onChange={(v) => setDateMode(v as DateMode)}
                options={[
                  { value: 'mom', label: 'Last 28 Days (MoM)' },
                  { value: 'yoy', label: 'Year-over-Year (YoY)' },
                ]}
                size="sm"
              />
            ) : null}
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: 'list', label: 'List View' },
                { value: 'group', label: 'Group by Silo/Path' },
              ]}
              size="sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search URL, keyword, or silo…"
              className="h-10 border-zinc-200 bg-slate-50 pl-9 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>
          <Select value={pathFilter} onValueChange={setPathFilter}>
            <SelectTrigger className="h-10 w-full border-zinc-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 sm:w-[180px]">
              <SelectValue placeholder="Path filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All paths</SelectItem>
              {paths.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={facetFilter}
            onValueChange={(v) => {
              setFacetFilter(v);
              setSelectedIds(new Set());
            }}
          >
            <SelectTrigger className="h-10 w-full border-zinc-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 sm:w-[220px]">
              <SelectValue
                placeholder={
                  segment === 'content-decay' ? 'All Diagnoses' : 'All Gaps'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {segment === 'content-decay' ? 'All Diagnoses' : 'All Gaps'}
              </SelectItem>
              {segment === 'content-decay'
                ? DIAGNOSES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))
                : OPTIMIZATION_GAPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {isLoading
              ? 'Aggregating GSC rows by canonical URL…'
              : `${formatClicks(filtered.length)} canonical pages · virtualized for ${formatClicks(rows.length)}+ source rows`}
          </span>
          <span className="hidden sm:inline">
            ROI uses ${avgValue} avg. conversion value
          </span>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <TriageTable
          items={flatItems}
          segment={segment}
          selectedIds={selectedIds}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onToggle={toggleId}
          onToggleAll={toggleAll}
          onUpdateRow={updateRow}
        />
      )}

      <BulkActionBar
        count={selectedRows.length}
        destinationLabel={bulkLabel}
        onSend={handleBulkSend}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Conversion value dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Average Conversion Value</DialogTitle>
            <DialogDescription>
              Used to estimate revenue at risk from lost clicks (clicks × CVR
              proxy × this value).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="avg-cvr">Value per conversion (USD)</Label>
            <Input
              id="avg-cvr"
              type="number"
              min={1}
              step={1}
              value={draftAvg}
              onChange={(e) => setDraftAvg(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={saveSettings}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  emphasize,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: 'rose' | 'amber' | 'sky' | 'alert' | 'emerald';
  loading?: boolean;
  emphasize?: boolean;
}) {
  const tones = {
    rose: {
      card: 'border-rose-500/20',
      icon: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      value: 'text-rose-700 dark:text-rose-300',
      glow: 'bg-rose-500/5',
    },
    amber: {
      card: 'border-amber-500/20',
      icon: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      value: 'text-amber-800 dark:text-amber-300',
      glow: 'bg-amber-500/5',
    },
    sky: {
      card: 'border-sky-500/20',
      icon: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
      value: 'text-sky-800 dark:text-sky-300',
      glow: 'bg-sky-500/5',
    },
    alert: {
      card: 'border-red-500/25 ring-1 ring-red-500/10',
      icon: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
      value: 'text-red-700 dark:text-red-300',
      glow: 'bg-red-500/5',
    },
    emerald: {
      card: 'border-emerald-500/25 ring-1 ring-emerald-500/10',
      icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      value: 'text-emerald-700 dark:text-emerald-300',
      glow: 'bg-emerald-500/5',
    },
  }[tone];

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-950 sm:p-5',
        'border-zinc-200 dark:border-zinc-800',
        tones.card,
        emphasize && 'relative overflow-hidden'
      )}
    >
      {emphasize ? (
        <div
          className={cn(
            'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full',
            tones.glow
          )}
        />
      ) : null}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            tones.icon
          )}
        >
          {emphasize && tone === 'alert' ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          ) : (
            <p
              className={cn(
                'mt-1 text-2xl font-bold tabular-nums tracking-tight',
                tones.value
              )}
            >
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  size = 'default',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  size?: 'default' | 'sm';
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      className={cn(
        'inline-flex w-full flex-wrap justify-start rounded-lg border border-zinc-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:w-auto',
        size === 'sm' && 'gap-0.5'
      )}
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className={cn(
            'flex-1 rounded-md border-0 bg-transparent px-3 text-xs text-zinc-600 shadow-none data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:text-zinc-400 dark:data-[state=on]:bg-zinc-800 dark:data-[state=on]:text-zinc-50 sm:flex-none',
            size === 'sm' ? 'h-8' : 'h-9'
          )}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-zinc-200 px-4 py-5 dark:border-zinc-800"
          >
            <div className="h-4 w-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-48 max-w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-32 max-w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="hidden h-8 w-[140px] animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 sm:block" />
            <div className="hidden h-5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 md:block" />
            <div className="hidden h-5 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800 lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

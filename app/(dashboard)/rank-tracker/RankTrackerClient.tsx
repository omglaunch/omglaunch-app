'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  Crosshair,
  Download,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { useProject } from '@/components/projects/ProjectProvider';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_TRACKING_FREQUENCY,
  INTENT_BADGE,
  TRACKING_FREQUENCY_OPTIONS,
  type RankTrackerKeywordRow,
  type RankTrackerSortField,
  type SortDirection,
  type TrackingFrequency,
} from '@/lib/rank-tracker/types';
import {
  computeAverageRank,
  computeTop3Count,
  computeVisibilityScore,
  formatRankDisplay,
  rankDelta,
  resolveDisplayHistory,
  resolvePositionSortValue,
} from '@/lib/rank-tracker/utils';
import {
  isIntentMismatch,
  resolveCannibalizationThreatLevel,
  THREAT_LEVEL_STYLES,
  type CompetingPage,
} from '@/lib/rank-tracker/cannibalization';
import { formatUrlPathForDisplay } from '@/lib/rank-tracker/url-normalize';
import {
  buildTrendSparklinePolyline,
  formatTrendAriaLabel,
  prepareTrendSparklinePoints,
  resolveTrendStrokeColor,
  TREND_SPARKLINE_HEIGHT,
  TREND_SPARKLINE_WIDTH,
} from '@/lib/rank-tracker/trend-sparkline';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import ReportExportGateDialog from '@/components/reports/ReportExportGateDialog';
import ShareLinkDialog from '@/components/client-share/ShareLinkDialog';
import { useGuardedReportExport } from '@/hooks/useGuardedReportExport';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import {
  buildRankTrackerCsv,
  buildRankTrackerCsvFilename,
} from '@/lib/rank-tracker/export-csv';

const PAGE_SIZE = 50;

function SortableHead({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
}: {
  label: string;
  field: RankTrackerSortField;
  sortField: RankTrackerSortField;
  sortDirection: SortDirection;
  onSort: (field: RankTrackerSortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground',
        active && 'text-foreground',
        className
      )}
    >
      {label}
      {active ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
}

function RankDelta({ row }: { row: RankTrackerKeywordRow }) {
  const displayHistory = resolveDisplayHistory(row);
  const delta = rankDelta(displayHistory);
  if (delta === null) {
    return (
      <Badge variant="secondary" className="font-normal text-muted-foreground">
        Pending...
      </Badge>
    );
  }
  if (displayHistory && displayHistory.position >= 101) {
    return null;
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const improved = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        improved
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-500 dark:text-red-400'
      )}
    >
      {improved ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )}
      {Math.abs(delta)}
    </span>
  );
}

function UrlRankingCell({ row }: { row: RankTrackerKeywordRow }) {
  const displayHistory = resolveDisplayHistory(row);
  const rankedUrl = row.rankedUrl ?? displayHistory?.rankedUrl ?? displayHistory?.urlFound ?? '';
  const competingPages = row.competingPages ?? displayHistory?.competingPages ?? null;
  const primaryRank = row.currentRank ?? displayHistory?.position ?? null;

  const showCannibalization = (competingPages?.length ?? 0) > 0;
  const showIntentMismatch = isIntentMismatch(
    row.targetUrl,
    rankedUrl,
    primaryRank
  );

  if (!rankedUrl) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {showCannibalization ? (
        <CannibalizationBadge
          rankedUrl={rankedUrl}
          primaryRank={primaryRank}
          competingPages={competingPages ?? []}
        />
      ) : null}
      {showIntentMismatch ? (
        <Badge
          variant="outline"
          className="border-orange-200 bg-orange-50 text-[11px] font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
        >
          ⚠️ Wrong Page
        </Badge>
      ) : null}
    </div>
  );

  return (
    <div className="min-w-0 max-w-full flex flex-col gap-1.5">
      <span
        className={cn(
          'block truncate text-sm text-muted-foreground',
          !row.isActive && 'text-muted-foreground',
          showIntentMismatch && 'text-orange-700 dark:text-orange-300'
        )}
        title={rankedUrl}
      >
        {formatUrlPathForDisplay(rankedUrl)}
      </span>
      {badges}
    </div>
  );
}

function CannibalizationBadge({
  rankedUrl,
  primaryRank,
  competingPages,
}: {
  rankedUrl: string;
  primaryRank: number | null;
  competingPages: CompetingPage[];
}) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
        >
          ⚠️ Cannibalization
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-3 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Multiple pages are competing for this keyword:
          </p>
        </div>
        <ul className="space-y-2 text-xs">
          <li className="rounded-md bg-muted px-2.5 py-2 text-foreground">
            <span className="font-medium text-foreground">[Primary]</span>{' '}
            {formatUrlPathForDisplay(rankedUrl)}
            {primaryRank != null ? (
              <span className="text-muted-foreground">{` (Rank: ${primaryRank})`}</span>
            ) : null}
          </li>
          {competingPages.map(page => {
            const threat =
              primaryRank != null
                ? resolveCannibalizationThreatLevel(primaryRank, page.rank)
                : 'low';
            const styles = THREAT_LEVEL_STYLES[threat];
            return (
              <li
                key={`${page.url}-${page.rank}`}
                className="rounded-md bg-muted px-2.5 py-2 text-foreground"
              >
                <span className={cn('font-medium', styles.text)}>
                  {styles.dot} [{styles.label}]
                </span>{' '}
                {formatUrlPathForDisplay(page.url)}
                <span className="text-muted-foreground">{` (Rank: ${page.rank})`}</span>
              </li>
            );
          })}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function RankTrendSparkline({ row }: { row: RankTrackerKeywordRow }) {
  const history = row.historyTrend;
  const points = useMemo(
    () => prepareTrendSparklinePoints(history),
    [history]
  );

  if (!history?.length) {
    return (
      <span className="flex h-8 w-24 items-center justify-center text-sm text-muted-foreground/40">
        —
      </span>
    );
  }

  const polyline = buildTrendSparklinePolyline(points);
  const stroke = resolveTrendStrokeColor(points);

  return (
    <svg
      width={TREND_SPARKLINE_WIDTH}
      height={TREND_SPARKLINE_HEIGHT}
      viewBox={`0 0 ${TREND_SPARKLINE_WIDTH} ${TREND_SPARKLINE_HEIGHT}`}
      className="overflow-visible"
      role="img"
      aria-label={formatTrendAriaLabel(points)}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accentClass: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            accentClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  onAddKeywords,
  disabled,
}: {
  onAddKeywords: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <TrendingUp className="h-7 w-7 text-emerald-400" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        No keywords tracked yet
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Add keywords to monitor SERP positions, detect cannibalization, and track
        competitors — all scoped to your active project.
      </p>
      <Button
        className="mt-6 gap-2 bg-emerald-600 hover:bg-emerald-500"
        size="lg"
        onClick={onAddKeywords}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        Add Your First Keywords
      </Button>
    </div>
  );
}

export default function RankTrackerClient() {
  const { activeProjectId } = useProject();
  const { agencyName, isViewer, canWrite } = useTeamAccess();
  const {
    branding,
    gateOpen,
    gateMessage,
    setGateOpen,
    runExport,
    confirmExport,
  } = useGuardedReportExport();
  const [rows, setRows] = useState<RankTrackerKeywordRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<RankTrackerSortField>('keyword');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [bulkTargetUrl, setBulkTargetUrl] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkTrackingFrequency, setBulkTrackingFrequency] =
    useState<TrackingFrequency>(DEFAULT_TRACKING_FREQUENCY);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingKeywords, setIsAddingKeywords] = useState(false);

  const loadKeywords = useCallback(async () => {
    if (!(activeProjectId ?? '').trim()) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/rank-tracker/keywords?projectId=${encodeURIComponent(activeProjectId)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? 'Failed to load keywords.');
      }

      const data = (await response.json()) as { keywords?: RankTrackerKeywordRow[] };
      setRows(data.keywords ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load keywords.';
      console.error('[RankTrackerClient] loadKeywords error:', error);
      toast.error(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void loadKeywords();
    setSelectedIds(new Set());
    setTagFilter('all');
    setPage(1);
    setSortField('keyword');
    setSortDirection('asc');
  }, [activeProjectId, loadKeywords]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    rows.forEach(row => {
      row.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (tagFilter === 'all') return rows;
    return rows.filter(row => row.tags.includes(tagFilter));
  }, [rows, tagFilter]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'keyword':
          cmp = a.keyword.localeCompare(b.keyword);
          break;
        case 'searchVolume':
          cmp = (a.searchVolume ?? 0) - (b.searchVolume ?? 0);
          break;
        case 'cpc':
          cmp = (a.cpc ?? 0) - (b.cpc ?? 0);
          break;
        case 'position':
          cmp = resolvePositionSortValue(a) - resolvePositionSortValue(b);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const paginatedRows = sortedRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const allPageSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every(row => selectedIds.has(row.id));
  const somePageSelected =
    paginatedRows.some(row => selectedIds.has(row.id)) && !allPageSelected;
  const selectionCount = selectedIds.size;
  const hasSelection = selectionCount > 0;

  const visibilityScore = computeVisibilityScore(rows);
  const averageRank = computeAverageRank(rows);
  const top3Count = computeTop3Count(rows);

  function handleSort(field: RankTrackerSortField) {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'keyword' ? 'asc' : 'desc');
    }
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      paginatedRows.forEach(row => {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      });
      return next;
    });
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const refreshKeywordRows = useCallback(async () => {
    if (!(activeProjectId ?? '').trim()) {
      return [] as RankTrackerKeywordRow[];
    }

    const response = await fetch(
      `/api/rank-tracker/keywords?projectId=${encodeURIComponent(activeProjectId)}`,
      { cache: 'no-store' }
    );
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      keywords?: RankTrackerKeywordRow[];
    };
    const keywords = data.keywords ?? [];
    setRows(keywords);
    return keywords;
  }, [activeProjectId]);

  const pollForRankUpdates = useCallback(
    async (maxAttempts = 40, intervalMs = 3000) => {
      if (!(activeProjectId ?? '').trim()) return;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        try {
          const keywords = await refreshKeywordRows();
          if (!keywords) continue;

          const stillPending = keywords.some(
            row => row.currentRank == null && !row.latestHistory
          );
          if (!stillPending) return;
        } catch {
          // Keep polling until attempts are exhausted.
        }
      }
    },
    [activeProjectId, refreshKeywordRows]
  );

  const requestRankCheck = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!(activeProjectId ?? '').trim()) {
        if (!options?.silent) {
          toast.error('Select a project before updating rankings.');
        }
        return null;
      }

      const response = await fetch('/api/rank-tracker/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        cached?: boolean;
        queued?: number;
        message?: string;
      } | null;

      if (!response.ok) {
        if (!options?.silent) {
          toast.error(data?.error ?? 'Failed to update rankings.');
        }
        return null;
      }

      if (!options?.silent) {
        if (data?.cached) {
          toast.info(
            data.message ?? 'Rankings are already up to date (cached).'
          );
        } else if ((data?.queued ?? 0) === 0) {
          toast.info(data?.message ?? 'No keywords need updating right now.');
        } else {
          const queued = data?.queued ?? 0;
          toast.success(
            `Checking ${queued} keyword${queued === 1 ? '' : 's'}…`
          );
        }
      }

      return data;
    },
    [activeProjectId]
  );

  const handleUpdateRankings = useCallback(async () => {
    setIsUpdating(true);

    try {
      const pollPromise = pollForRankUpdates();
      const data = await requestRankCheck();
      if (!data) return;

      if ((data.queued ?? 0) > 0) {
        await pollPromise;
        const keywords = await refreshKeywordRows();
        const stillPending = (keywords ?? []).some(
          row => row.currentRank == null && !row.latestHistory
        );
        if (stillPending) {
          toast.info(
            'Rank check is still running. Results usually appear within 1–2 minutes — refresh if needed.'
          );
        }
      } else {
        await loadKeywords();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update rankings.';
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  }, [loadKeywords, pollForRankUpdates, refreshKeywordRows, requestRankCheck]);

  const handleAddKeywords = useCallback(async () => {
    if (!canWrite) {
      toast.error('You do not have permission to add keywords.');
      return;
    }

    if (!(activeProjectId ?? '').trim()) {
      toast.error('Select a project before adding keywords.');
      return;
    }

    const lines = bulkKeywords
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error('Paste at least one keyword.');
      return;
    }

    const tags = bulkTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const existing = new Set(rows.map(r => r.keyword.toLowerCase()));
    const newKeywords = lines.filter(
      keyword => !existing.has(keyword.toLowerCase())
    );

    if (newKeywords.length === 0) {
      toast.error('All pasted keywords already exist in this project.');
      return;
    }

    setIsAddingKeywords(true);

    try {
      const response = await fetch('/api/rank-tracker/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          keywords: newKeywords,
          targetUrl: bulkTargetUrl.trim() || null,
          tags,
          trackingFrequency: bulkTrackingFrequency,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        inserted?: number;
        skipped?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to add keywords.');
      }

      const inserted = data?.inserted ?? 0;
      const skipped = data?.skipped ?? 0;

      if (inserted === 0) {
        toast.error(
          skipped > 0
            ? 'All pasted keywords already exist in this project.'
            : 'No keywords were added.'
        );
        return;
      }

      await loadKeywords();
      setBulkKeywords('');
      setBulkTargetUrl('');
      setBulkTags('');
      setBulkTrackingFrequency(DEFAULT_TRACKING_FREQUENCY);
      setAddModalOpen(false);

      const skippedNote =
        skipped > 0
          ? ` ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.`
          : '';
      toast.success(
        `Added ${inserted} keyword${inserted === 1 ? '' : 's'}.${skippedNote} Starting first rank check…`
      );

      const pollPromise = pollForRankUpdates();
      const triggerData = await requestRankCheck({ silent: true });
      if (triggerData && (triggerData.queued ?? 0) > 0) {
        await pollPromise;
      } else if (triggerData && (triggerData.queued ?? 0) === 0) {
        toast.info(
          triggerData.message ??
            'Keywords saved. Click Update Rankings if positions stay pending.'
        );
      } else if (!triggerData) {
        toast.warning(
          'Keywords saved, but rank check could not start. Click Update Rankings or check DataForSEO settings.'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add keywords.';
      toast.error(message);
    } finally {
      setIsAddingKeywords(false);
    }
  }, [
    bulkKeywords,
    bulkTags,
    bulkTargetUrl,
    bulkTrackingFrequency,
    activeProjectId,
    canWrite,
    loadKeywords,
    pollForRankUpdates,
    requestRankCheck,
    rows,
  ]);

  function handleBulkPause() {
    setRows(prev =>
      prev.map(row =>
        selectedIds.has(row.id) ? { ...row, isActive: false } : row
      )
    );
    toast.success(`Paused ${selectionCount} keyword${selectionCount === 1 ? '' : 's'}.`);
    setSelectedIds(new Set());
  }

  function handleBulkResume() {
    setRows(prev =>
      prev.map(row =>
        selectedIds.has(row.id) ? { ...row, isActive: true } : row
      )
    );
    toast.success(`Resumed ${selectionCount} keyword${selectionCount === 1 ? '' : 's'}.`);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    setRows(prev => prev.filter(row => !selectedIds.has(row.id)));
    toast.success(`Deleted ${selectionCount} keyword${selectionCount === 1 ? '' : 's'}.`);
    setSelectedIds(new Set());
  }

  function handleBulkAddTag() {
    const tag = bulkTagValue.trim();
    if (!tag) {
      toast.error('Enter a tag name.');
      return;
    }
    setRows(prev =>
      prev.map(row => {
        if (!selectedIds.has(row.id)) return row;
        if (row.tags.includes(tag)) return row;
        return { ...row, tags: [...row.tags, tag] };
      })
    );
    setBulkTagValue('');
    setBulkTagOpen(false);
    toast.success(`Tag "${tag}" applied.`);
    setSelectedIds(new Set());
  }

  function handleBulkForceRefresh() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    void (async () => {
      if (!(activeProjectId ?? '').trim()) return;

      setIsUpdating(true);
      try {
        const response = await fetch('/api/rank-tracker/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: activeProjectId,
            forceRefreshKeywordIds: ids,
          }),
        });

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          queued?: number;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? 'Force refresh failed.');
        }

        toast.success(
          `Force refresh queued for ${data?.queued ?? ids.length} keyword${ids.length === 1 ? '' : 's'}.`
        );
        await loadKeywords();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Force refresh failed.';
        toast.error(message);
      } finally {
        setIsUpdating(false);
        setSelectedIds(new Set());
      }
    })();
  }

  function handleExportCsv() {
    runExport(async () => {
      const csv = buildRankTrackerCsv(sortedRows, branding);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = buildRankTrackerCsvFilename(
        branding,
        activeProjectId ?? 'project'
      );
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-6">
      <ReportExportGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        message={gateMessage}
        onConfirm={confirmExport}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Crosshair className="h-3.5 w-3.5" />
            Rank Tracker
          </div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
            SERP Position Monitoring
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Enterprise SERP monitoring with cannibalization detection and competitor context.
            Exports use the client brand ({branding.clientBrandLabel}
            {isViewer ? '' : ` · prepared by ${agencyName}`}) — not your agency workspace name.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <TrendingUp className="h-6 w-6 text-emerald-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <p className="text-sm text-muted-foreground">Loading keywords…</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          onAddKeywords={() => setAddModalOpen(true)}
          disabled={!canWrite || !activeProjectId}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Visibility Score"
              value={`${visibilityScore}%`}
              icon={TrendingUp}
              accentClass="border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            />
            <SummaryCard
              label="Average Rank"
              value={averageRank}
              icon={ArrowUp}
              accentClass="border-sky-100 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
            />
            <SummaryCard
              label="Top 3 Rankings"
              value={String(top3Count)}
              icon={Sparkles}
              accentClass="border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
            />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              {hasSelection ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {selectionCount} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleBulkPause}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleBulkResume}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setBulkTagOpen(true)}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    Add Tag
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleBulkForceRefresh}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Force Refresh
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setAddModalOpen(true)}
                    disabled={!canWrite || !activeProjectId}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Keywords
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => void handleUpdateRankings()}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {isUpdating ? 'Updating Positions...' : 'Update Rankings'}
                  </Button>
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger className="h-9 w-[140px] text-sm">
                      <SelectValue placeholder="Tag filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {availableTags.map(tag => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    disabled
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Date Range
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </div>
              )}

              {!hasSelection && (
                <div className="flex items-center gap-2">
                  {canWrite && activeProjectId ? (
                    <ShareLinkDialog
                      projectId={activeProjectId}
                      reportType="rank_tracker"
                      triggerLabel="Share snapshot"
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={handleExportCsv}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              )}
            </div>

            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allPageSelected
                          ? true
                          : somePageSelected
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={checked =>
                        toggleSelectAll(checked === true)
                      }
                      aria-label="Select all keywords on page"
                    />
                  </TableHead>
                  <TableHead className="w-[28%]">
                    <SortableHead
                      label="Keyword"
                      field="keyword"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="w-[10%]">
                    <SortableHead
                      label="Volume"
                      field="searchVolume"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="w-[8%]">
                    <SortableHead
                      label="CPC"
                      field="cpc"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="w-[12%]">
                    <SortableHead
                      label="Rank"
                      field="position"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="w-[12%] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Trend
                  </TableHead>
                  <TableHead className="w-[22%] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    URL Ranking
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map(row => {
                  const intentBadge = INTENT_BADGE[row.intent];
                  const displayHistory = resolveDisplayHistory(row);
                  const rankLabel = formatRankDisplay(
                    displayHistory,
                    row.currentRank
                  );
                  const pending = row.currentRank == null && !row.latestHistory;

                  return (
                    <TableRow
                      key={row.id}
                      data-state={
                        selectedIds.has(row.id) ? 'selected' : undefined
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={checked =>
                            toggleSelect(row.id, checked === true)
                          }
                          aria-label={`Select ${row.keyword}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-0">
                        <div
                          className={cn(
                            'flex min-w-0 flex-col gap-1',
                            !row.isActive && 'text-muted-foreground'
                          )}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'truncate font-medium',
                                row.isActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                              )}
                              title={row.keyword}
                            >
                              {row.keyword}
                            </span>
                            <span
                              className={cn(
                                'inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold',
                                intentBadge.className
                              )}
                              title={row.intent}
                            >
                              {intentBadge.label}
                            </span>
                            {row.latestHistory?.isFeaturedSnippet && (
                              <Sparkles
                                className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400"
                                aria-label="Featured snippet"
                              />
                            )}
                            {row.latestHistory?.isLocalPack && (
                              <MapPin
                                className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400"
                                aria-label="Local pack"
                              />
                            )}
                          </div>
                          {!row.isActive && (
                            <span className="text-[11px] text-muted-foreground">
                              Paused
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'tabular-nums',
                          !row.isActive && 'text-muted-foreground'
                        )}
                      >
                        {row.searchVolume != null
                          ? row.searchVolume.toLocaleString()
                          : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'tabular-nums',
                          !row.isActive && 'text-muted-foreground'
                        )}
                      >
                        {row.cpc != null ? `$${row.cpc.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {pending ? (
                            <Badge
                              variant="secondary"
                              className="font-normal text-muted-foreground"
                            >
                              Pending...
                            </Badge>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  'text-sm font-semibold tabular-nums',
                                  !row.isActive && 'text-muted-foreground',
                                  displayHistory &&
                                    displayHistory.position >= 101 &&
                                    'text-muted-foreground'
                                )}
                              >
                                {rankLabel}
                              </span>
                              <RankDelta row={row} />
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RankTrendSparkline row={row} />
                      </TableCell>
                      <TableCell className="min-w-0">
                        <UrlRankingCell row={row} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, sortedRows.length)} of{' '}
                  {sortedRows.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Keywords</DialogTitle>
            <DialogDescription>
              Paste keywords one per line. Tags, target URL, and tracking
              frequency apply to all entries. Duplicates within this project
              are blocked to protect API costs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-keywords">Keywords</Label>
              <Textarea
                id="bulk-keywords"
                placeholder={'seo audit tool\nkeyword rank tracker\nlocal seo malaysia'}
                rows={8}
                value={bulkKeywords}
                onChange={e => setBulkKeywords(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-target-url">Target URL (all)</Label>
                <Input
                  id="bulk-target-url"
                  placeholder="https://example.com/page"
                  value={bulkTargetUrl}
                  onChange={e => setBulkTargetUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-tags">Tags (comma-separated)</Label>
                <Input
                  id="bulk-tags"
                  placeholder="core, product"
                  value={bulkTags}
                  onChange={e => setBulkTags(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bulk-tracking-frequency">Tracking Frequency</Label>
                <Select
                  value={bulkTrackingFrequency}
                  onValueChange={value =>
                    setBulkTrackingFrequency(value as TrackingFrequency)
                  }
                >
                  <SelectTrigger id="bulk-tracking-frequency">
                    <SelectValue placeholder="Weekly" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKING_FREQUENCY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddModalOpen(false)}
              disabled={isAddingKeywords}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
              onClick={() => void handleAddKeywords()}
              disabled={isAddingKeywords || !canWrite}
            >
              {isAddingKeywords ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isAddingKeywords ? 'Adding…' : 'Add Keywords'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tag to Selected</DialogTitle>
            <DialogDescription>
              Apply a tag to {selectionCount} selected keyword
              {selectionCount === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Tag name"
            value={bulkTagValue}
            onChange={e => setBulkTagValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={handleBulkAddTag}>
              Apply Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

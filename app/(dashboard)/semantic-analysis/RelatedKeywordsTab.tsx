'use client';

import { ArrowDownUp, ExternalLink, Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RelatedKeyword } from '@/lib/semantic-metrics';
import {
  getRelatedDataEmptyMessage,
  isDataForSeoEmptyResultMessage,
} from '@/lib/semantic-analysis/messages';
import { cn } from '@/lib/utils';

type RelatedKeywordsTabProps = {
  data: RelatedKeyword[] | null;
  isLoading: boolean;
  error?: string | null;
};

type SortKey =
  | 'expression'
  | 'frequency'
  | 'searchVolume'
  | 'concurrence'
  | 'cpc'
  | 'difficulty'
  | 'intention'
  | 'interestScore';

type SortDirection = 'asc' | 'desc';

function InterestCell({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 100);

  return (
    <div className="relative min-w-[88px] px-2 py-2">
      <div
        className="absolute inset-y-1 left-2 z-0 rounded-sm bg-green-200"
        style={{ width: `calc(${clamped}% - 0.5rem)` }}
        aria-hidden
      />
      <span className="relative z-10 font-medium tabular-nums text-foreground">{score}</span>
    </div>
  );
}

function formatFrequency(count: number): string {
  return count === 1 ? '1 time' : `${count} times`;
}

function formatCpc(value: number | null): string {
  if (value === null) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatVolume(value: number): string {
  return value.toLocaleString();
}

function exportToolbarLabel(action: 'excel' | 'copy' | 'pdf'): string {
  switch (action) {
    case 'excel':
      return 'Excel';
    case 'copy':
      return 'Copy';
    case 'pdf':
      return 'PDF';
  }
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr
          key={index}
          className={cn('border-b border-border', index % 2 === 1 && 'bg-muted')}
        >
          {Array.from({ length: 8 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-gray-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function RelatedKeywordsTab({ data, isLoading, error }: RelatedKeywordsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('interestScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;
  const keywords = data ?? [];
  const hasLoaded = data !== null;
  const emptyMessage = getRelatedDataEmptyMessage('keywords', error, hasLoaded);
  const showInfoBanner = Boolean(error) && isDataForSeoEmptyResultMessage(error);
  const showErrorBanner = Boolean(error) && !showInfoBanner;

  const filteredKeywords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = keywords;

    if (query) {
      rows = rows.filter(
        keyword =>
          keyword.expression.toLowerCase().includes(query) ||
          (keyword.intention ?? '').toLowerCase().includes(query)
      );
    }

    const sorted = [...rows].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'expression':
          comparison = a.expression.localeCompare(b.expression);
          break;
        case 'frequency':
          comparison = a.frequency - b.frequency;
          break;
        case 'searchVolume':
          comparison = a.searchVolume - b.searchVolume;
          break;
        case 'concurrence':
          comparison = a.concurrence - b.concurrence;
          break;
        case 'cpc':
          comparison = (a.cpc ?? 0) - (b.cpc ?? 0);
          break;
        case 'difficulty':
          comparison = (a.difficulty ?? 0) - (b.difficulty ?? 0);
          break;
        case 'intention':
          comparison = (a.intention ?? '').localeCompare(b.intention ?? '');
          break;
        case 'interestScore':
          comparison = a.interestScore - b.interestScore;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [keywords, searchQuery, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredKeywords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedKeywords = filteredKeywords.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const toggleSort = (key: SortKey) => {
    setCurrentPage(1);
    if (sortKey === key) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'expression' || key === 'intention' ? 'asc' : 'desc');
  };

  const SortableHeader = ({
    label,
    columnKey,
    className,
  }: {
    label: string;
    columnKey: SortKey;
    className?: string;
  }) => (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
    >
      <button
        type="button"
        onClick={() => toggleSort(columnKey)}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {label}
        <ArrowDownUp
          className={cn(
            'h-3 w-3',
            sortKey === columnKey ? 'text-emerald-600 dark:text-blue-600' : 'text-muted-foreground'
          )}
          aria-hidden
        />
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Find in this table ideas of keywords, sorted by interest, according to the balance between
        their search volume, their competition and the number of words in the expression.
      </p>

      {showInfoBanner ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-900">
          {error}
        </div>
      ) : null}

      {showErrorBanner ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['excel', 'copy', 'pdf'] as const).map(action => (
            <button
              key={action}
              type="button"
              className="rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
            >
              {exportToolbarLabel(action)}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={event => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Research"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-blue-400 dark:focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/80">
              <SortableHeader label="Expression" columnKey="expression" />
              <SortableHeader label="Frequency on the page" columnKey="frequency" />
              <SortableHeader label="Monthly volume" columnKey="searchVolume" />
              <SortableHeader label="Concurrence" columnKey="concurrence" />
              <SortableHeader label="CPC" columnKey="cpc" />
              <SortableHeader label="Difficulty" columnKey="difficulty" />
              <SortableHeader label="Intention" columnKey="intention" />
              <SortableHeader label="Interest (out of 100)" columnKey="interestScore" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <tr>
                  <td colSpan={8} className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-blue-600" aria-hidden />
                      Loading related keywords…
                    </div>
                  </td>
                </tr>
                <TableSkeleton />
              </>
            ) : null}
            {!isLoading && paginatedKeywords.length > 0 ? (
              paginatedKeywords.map((keyword, index) => (
                <tr
                  key={`${keyword.expression}-${index}`}
                  className={cn(
                    'border-b border-border last:border-b-0',
                    index % 2 === 1 && 'bg-muted'
                  )}
                >
                  <td className="px-4 py-3">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(keyword.expression)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-emerald-600 hover:text-emerald-700 hover:underline dark:text-blue-600 dark:hover:text-blue-700"
                    >
                      {keyword.expression}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </a>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {formatFrequency(keyword.frequency)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {formatVolume(keyword.searchVolume)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{keyword.concurrence}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {formatCpc(keyword.cpc)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{keyword.difficulty ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-foreground">{keyword.intention ?? '—'}</td>
                  <td className="px-4 py-3">
                    <InterestCell score={keyword.interestScore} />
                  </td>
                </tr>
              ))
            ) : null}
            {!isLoading && paginatedKeywords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? 'No related keywords match your search filter.'
                    : emptyMessage.message}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
          disabled={safePage <= 1}
          className="transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="font-medium tabular-nums text-foreground">{safePage}</span>
        <button
          type="button"
          onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
          disabled={safePage >= totalPages}
          className="transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

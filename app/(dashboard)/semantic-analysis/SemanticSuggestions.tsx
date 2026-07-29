'use client';

import { ArrowDownUp, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  formatIdealRange,
  type SemanticCriterion,
} from '@/lib/semantic-metrics';
import { getSemanticSuggestionsEmptyMessage } from '@/lib/semantic-analysis/messages';
import { isTermUsageHealthy } from '@/lib/semantic-scoring';
import { cn } from '@/lib/utils';

type SemanticSuggestionsProps = {
  criteria: SemanticCriterion[];
  totalWords: number;
  semanticScore: number;
  isLoading?: boolean;
  semanticError?: string | null;
};

type SortKey =
  | 'expression'
  | 'context'
  | 'occurrence'
  | 'idealOccurrence'
  | 'frequencyInTitle'
  | 'tfIdf'
  | 'interestScore';

type SortDirection = 'asc' | 'desc';

function OccurrenceIndicator({ withinIdeal }: { withinIdeal: boolean }) {
  return (
    <span
      className={cn(
        'mr-2 inline-block h-2 w-2 shrink-0 rounded-full',
        withinIdeal ? 'bg-emerald-500' : 'bg-red-500'
      )}
      aria-label={withinIdeal ? 'Present with healthy usage' : 'Absent or overused'}
    />
  );
}

function InterestCell({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 100);

  return (
    <div className="relative min-w-[72px] px-2 py-1">
      <div
        className="absolute inset-y-1 left-2 rounded-sm bg-emerald-100"
        style={{ width: `calc(${clamped}% - 0.5rem)` }}
        aria-hidden
      />
      <span className="relative z-10 font-medium tabular-nums text-foreground">{score}</span>
    </div>
  );
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

function truncateContext(context: string, maxLength = 55): string {
  const trimmed = context.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}

export default function SemanticSuggestions({
  criteria,
  totalWords,
  semanticScore,
  isLoading = false,
  semanticError = null,
}: SemanticSuggestionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('interestScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const clampedScore = Math.min(Math.max(semanticScore, 0), 100);

  const emptyState = getSemanticSuggestionsEmptyMessage({
    criteriaCount: criteria.length,
    totalWords,
    hasSearchFilter: Boolean(searchQuery.trim()),
    semanticError,
  });

  const filteredCriteria = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = criteria;

    if (query) {
      rows = rows.filter(
        criterion =>
          criterion.expression.toLowerCase().includes(query) ||
          criterion.context.toLowerCase().includes(query)
      );
    }

    const sorted = [...rows].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'expression':
          comparison = a.expression.localeCompare(b.expression);
          break;
        case 'context':
          comparison = a.context.localeCompare(b.context);
          break;
        case 'occurrence':
          comparison = a.occurrence.current - b.occurrence.current;
          break;
        case 'idealOccurrence':
          comparison = a.idealOccurrence.min - b.idealOccurrence.min;
          break;
        case 'frequencyInTitle':
          comparison = a.frequencyInTitle - b.frequencyInTitle;
          break;
        case 'tfIdf':
          comparison = a.tfIdf - b.tfIdf;
          break;
        case 'interestScore':
          comparison = a.interestScore - b.interestScore;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [criteria, searchQuery, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'expression' || key === 'context' ? 'asc' : 'desc');
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Suggestions use competitor density benchmarks, TF-IDF, and presence-based scoring.
          Green bullets indicate a term is present with healthy usage; red bullets indicate absent
          or overused terms. Total word count of the page: {totalWords.toLocaleString()}.
        </p>

        <div className="w-full shrink-0 rounded-xl border border-border bg-card p-4 shadow-sm lg:w-56">
          <p className="text-sm font-medium text-foreground">Semantic score</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            {semanticScore.toFixed(0)}%
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-pink-500 transition-all duration-700"
              style={{ width: `${clampedScore}%` }}
            />
          </div>
        </div>
      </div>

      {emptyState && emptyState.tone !== 'filter' ? (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            emptyState.tone === 'error'
              ? 'border border-red-200 bg-red-50 text-red-900'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-900'
          )}
        >
          {emptyState.message}
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
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Research"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-blue-400 dark:focus:ring-blue-100"
          />
        </div>
      </div>

      <div
        className={cn(
          'overflow-x-auto rounded-xl border border-border bg-card shadow-sm',
          isLoading && 'opacity-60 transition-opacity'
        )}
      >
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/80">
              <SortableHeader label="Expression" columnKey="expression" />
              <SortableHeader label="Context" columnKey="context" />
              <SortableHeader
                label="Occurrence (max concurrence)"
                columnKey="occurrence"
              />
              <SortableHeader label="Ideal occurrence" columnKey="idealOccurrence" />
              <SortableHeader label="Frequency in Title" columnKey="frequencyInTitle" />
              <SortableHeader label="Average TF-IDF" columnKey="tfIdf" />
              <SortableHeader label="Interest on 100" columnKey="interestScore" />
            </tr>
          </thead>
          <tbody>
            {filteredCriteria.length > 0 ? (
              filteredCriteria.map((criterion, index) => {
                const withinIdeal = isTermUsageHealthy(
                  criterion.occurrence,
                  criterion.idealOccurrence
                );

                return (
                  <tr
                    key={`${criterion.expression}-${index}`}
                    className={cn(
                      'border-b border-border last:border-b-0',
                      index % 2 === 1 && 'bg-muted'
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {criterion.expression}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground" title={criterion.context || undefined}>
                      {criterion.context ? truncateContext(criterion.context) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      <span className="inline-flex items-center">
                        <OccurrenceIndicator withinIdeal={withinIdeal} />
                        {criterion.occurrence.current} ({criterion.occurrence.maxCompetition})
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {formatIdealRange(criterion.idealOccurrence)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded px-2 py-0.5 tabular-nums',
                          criterion.frequencyInTitle >= 50 && 'bg-emerald-100 text-emerald-900'
                        )}
                      >
                        {criterion.frequencyInTitle}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {criterion.tfIdf.toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      <InterestCell score={criterion.interestScore} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {isLoading
                    ? 'Calculating semantic suggestions…'
                    : emptyState?.tone === 'filter'
                      ? emptyState.message
                      : emptyState
                        ? '—'
                        : 'No semantic suggestions available.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

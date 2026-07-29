'use client';

import { ArrowDownUp, ExternalLink, Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import type { RelatedQuestion } from '@/lib/semantic-metrics';
import {
  getRelatedDataEmptyMessage,
  isDataForSeoEmptyResultMessage,
} from '@/lib/semantic-analysis/messages';
import { cn } from '@/lib/utils';

type RelatedQuestionsTabProps = {
  data: RelatedQuestion[] | null;
  targetKeyword: string;
  isLoading: boolean;
  error?: string | null;
};

type SortKey = 'expression' | 'searchVolume' | 'interrogativeWord';
type SortDirection = 'asc' | 'desc';

type ChartSegment = {
  name: string;
  value: number;
  fill: string;
};

const COLORS = [
  '#38BDF8',
  '#6366F1',
  '#22C55E',
  '#F97316',
  '#14B8A6',
  '#EC4899',
  '#EAB308',
  '#EF4444',
  '#06B6D4',
  '#4F46E5',
];

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

function formatVolume(value: number): string {
  return value.toLocaleString();
}

function highlightKeyword(text: string, keyword: string) {
  if (!keyword.trim()) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}
      <strong className="font-semibold text-emerald-700 dark:text-blue-700">
        {text.slice(index, index + keyword.length)}
      </strong>
      {text.slice(index + keyword.length)}
    </>
  );
}

function buildChartData(questions: RelatedQuestion[]): ChartSegment[] {
  const counts = new Map<string, number>();

  for (const question of questions) {
    const word = question.interrogativeWord || 'Other';
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const segments = Array.from(counts.entries()).sort((a, b) => {
    if (a[0] === 'Other') return 1;
    if (b[0] === 'Other') return -1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return segments.map(([name, value], index) => ({
    name,
    value,
    fill: COLORS[index % COLORS.length],
  }));
}

function renderSegmentLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  name?: string;
  percent?: number;
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    name = '',
    percent = 0,
  } = props;

  if (percent < 0.06) {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-sm font-medium capitalize"
    >
      {name}
    </text>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr
          key={index}
          className={cn('border-b border-border', index % 2 === 1 && 'bg-muted')}
        >
          {Array.from({ length: 3 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-gray-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function InterrogativeFormChart({ data }: { data: ChartSegment[] }) {
  const chartWidth = 500;
  const chartHeight = 260;
  const cx = chartWidth / 2;
  const cy = chartHeight * 0.9;
  const innerRadius = 88;
  const labelY = cy - innerRadius * 0.52;

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] w-full max-w-xl items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 text-sm text-muted-foreground">
        No interrogative distribution available.
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-xl">
      <PieChart width={chartWidth} height={chartHeight}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx={cx}
          cy={cy}
          startAngle={180}
          endAngle={0}
          innerRadius={innerRadius}
          outerRadius={138}
          paddingAngle={1}
          stroke="#ffffff"
          strokeWidth={2}
          label={renderSegmentLabel}
          labelLine={false}
        >
          {data.map(entry => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#1f2937"
          fontSize={14}
          fontWeight={500}
        >
          Interrogative form
        </text>
      </PieChart>
    </div>
  );
}

export default function RelatedQuestionsTab({
  data,
  targetKeyword,
  isLoading,
  error,
}: RelatedQuestionsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('searchVolume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;
  const questions = data ?? [];
  const hasLoaded = data !== null;
  const emptyMessage = getRelatedDataEmptyMessage('questions', error, hasLoaded);
  const showInfoBanner = Boolean(error) && isDataForSeoEmptyResultMessage(error);
  const showErrorBanner = Boolean(error) && !showInfoBanner;
  const chartData = useMemo(() => buildChartData(questions), [questions]);

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = questions;

    if (query) {
      rows = rows.filter(
        question =>
          question.expression.toLowerCase().includes(query) ||
          question.interrogativeWord.toLowerCase().includes(query)
      );
    }

    const sorted = [...rows].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'expression':
          comparison = a.expression.localeCompare(b.expression);
          break;
        case 'searchVolume':
          comparison = a.searchVolume - b.searchVolume;
          break;
        case 'interrogativeWord':
          comparison = a.interrogativeWord.localeCompare(b.interrogativeWord);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [questions, searchQuery, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuestions = filteredQuestions.slice(
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
    setSortDirection(key === 'expression' || key === 'interrogativeWord' ? 'asc' : 'desc');
  };

  const SortableHeader = ({
    label,
    columnKey,
    className,
    align = 'left',
  }: {
    label: string;
    columnKey: SortKey;
    className?: string;
    align?: 'left' | 'right';
  }) => (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        align === 'right' ? 'text-right' : 'text-left',
        className
      )}
    >
      <button
        type="button"
        onClick={() => toggleSort(columnKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          align === 'right' && 'ml-auto'
        )}
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
        Find in this table the questions asked by the competition. This can give you ideas for
        content you can write to answer questions not yet addressed elsewhere. You may find some
        off-topic questions here - feel free to ignore them.
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

      {!isLoading && questions.length > 0 ? (
        <InterrogativeFormChart data={chartData} />
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
              <SortableHeader label="Questions" columnKey="expression" />
              <SortableHeader label="Volume" columnKey="searchVolume" align="right" />
              <SortableHeader
                label="Mot interrogatif"
                columnKey="interrogativeWord"
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <tr>
                  <td colSpan={3} className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-blue-600" aria-hidden />
                      Loading related questions…
                    </div>
                  </td>
                </tr>
                <TableSkeleton />
              </>
            ) : null}
            {!isLoading && paginatedQuestions.length > 0
              ? paginatedQuestions.map((question, index) => (
                  <tr
                    key={`${question.expression}-${index}`}
                    className={cn(
                      'border-b border-border last:border-b-0',
                      index % 2 === 1 && 'bg-muted'
                    )}
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(question.expression)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 hover:underline dark:text-blue-600 dark:hover:text-blue-700"
                      >
                        {highlightKeyword(question.expression, targetKeyword)}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatVolume(question.searchVolume)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {question.interrogativeWord}
                    </td>
                  </tr>
                ))
              : null}
            {!isLoading && paginatedQuestions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? 'No related questions match your search filter.'
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

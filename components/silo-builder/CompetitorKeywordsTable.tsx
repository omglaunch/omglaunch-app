'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RankedKeywordRow } from '@/lib/silo-builder/dataforseo-ranked';
import { cn } from '@/lib/utils';

type CompetitorKeywordsTableProps = {
  keywords: RankedKeywordRow[];
  keywordsAnalyzed: number | null;
  importedFromTopicalMap?: boolean;
};

type SortKey = 'keyword' | 'searchVolume' | 'rank';
type SortDirection = 'asc' | 'desc';

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return value.toLocaleString();
}

function SortButton({
  label,
  active,
  direction,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground',
        align === 'right' && 'ml-auto'
      )}
    >
      {label}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export default function CompetitorKeywordsTable({
  keywords,
  keywordsAnalyzed,
  importedFromTopicalMap = false,
}: CompetitorKeywordsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('searchVolume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedKeywords = useMemo(() => {
    const copy = [...keywords];
    copy.sort((left, right) => {
      if (sortKey === 'keyword') {
        const comparison = left.keyword.localeCompare(right.keyword);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      const leftValue = left[sortKey] ?? (sortDirection === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const rightValue = right[sortKey] ?? (sortDirection === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const comparison = leftValue - rightValue;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return copy;
  }, [keywords, sortDirection, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === 'keyword' ? 'asc' : 'desc');
  }

  if (!keywords.length) {
    return (
      <Card className="border-border bg-card/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 shrink-0 text-emerald-600 dark:text-indigo-400" />
            <div>
              <CardTitle className="text-base">Competitor Ranked Keywords</CardTitle>
              <CardDescription>
                {importedFromTopicalMap
                  ? 'Keywords not available for imported maps.'
                  : keywordsAnalyzed != null && keywordsAnalyzed > 0
                    ? `${keywordsAnalyzed.toLocaleString()} keywords were analyzed, but ranked rows are not stored for this project.`
                    : 'Ranked keyword data will appear after a new competitor attack run.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/80 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 shrink-0 text-emerald-600 dark:text-indigo-400" />
            <div>
              <CardTitle className="text-base">Competitor Ranked Keywords</CardTitle>
              <CardDescription>
                Top {keywords.length.toLocaleString()} keywords by search volume from the competitor
                analysis
                {keywordsAnalyzed != null && keywordsAnalyzed > keywords.length
                  ? ` (${keywordsAnalyzed.toLocaleString()} total analyzed)`
                  : ''}
                .
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton
                  label="Keyword"
                  active={sortKey === 'keyword'}
                  direction={sortDirection}
                  onClick={() => toggleSort('keyword')}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortButton
                  label="Search Volume"
                  active={sortKey === 'searchVolume'}
                  direction={sortDirection}
                  onClick={() => toggleSort('searchVolume')}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortButton
                  label="Rank"
                  active={sortKey === 'rank'}
                  direction={sortDirection}
                  onClick={() => toggleSort('rank')}
                  align="right"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedKeywords.map(row => (
              <TableRow key={row.keyword}>
                <TableCell className="font-medium text-foreground">{row.keyword}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatMetric(row.searchVolume)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatMetric(row.rank)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

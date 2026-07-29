'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { GridCell } from '@/lib/local-dominance/types';
import { getGeogridLayout } from '@/lib/local-dominance/geogrid-layout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type GeogridHeatMapProps = {
  cells: GridCell[];
  gridSize: number;
  onCellClick?: (cell: GridCell) => void;
  className?: string;
};

function rankColor(rank: number | null): string {
  if (rank === null) return 'bg-zinc-200 border-zinc-300 dark:bg-slate-700/90 dark:border-slate-600';
  if (rank === 1) return 'bg-emerald-500 border-emerald-400';
  if (rank === 2) return 'bg-lime-500 border-lime-400';
  if (rank === 3) return 'bg-yellow-500 border-yellow-400';
  if (rank <= 10) return 'bg-orange-600 border-orange-500';
  return 'bg-red-700 border-red-600';
}

export default function GeogridHeatMap({
  cells,
  gridSize,
  onCellClick,
  className,
}: GeogridHeatMapProps) {
  const [selected, setSelected] = useState<GridCell | null>(null);
  const layout = getGeogridLayout(gridSize);

  return (
    <>
      <div className={cn('mx-auto w-fit max-w-full', className)}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, ${layout.cellSize}px)`,
            gap: layout.gap,
          }}
        >
          {cells.map(cell => (
            <button
              key={`${cell.row}-${cell.col}`}
              type="button"
              onClick={() => {
                setSelected(cell);
                onCellClick?.(cell);
              }}
              style={{
                width: layout.cellSize,
                height: layout.cellSize,
              }}
              className={cn(
                'rounded-md border-2 transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-blue-500 dark:focus:ring-offset-slate-900',
                rankColor(cell.rank),
                cell.aiVisible === true &&
                  'ring-2 ring-cyan-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
              )}
              title={`Rank: ${cell.rank ?? 'N/A'} | AI: ${cell.aiVisible === true ? 'Yes' : cell.aiVisible === false ? 'No' : '—'}`}
            >
              <span
                className={cn(
                  'flex h-full w-full items-center justify-center drop-shadow',
                  cell.rank === null
                    ? 'text-zinc-500 dark:text-white'
                    : 'text-white',
                  layout.rankClass
                )}
              >
                {cell.rank ?? '—'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-md border-zinc-200 bg-white text-zinc-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>
              Map Pack — Cell ({selected?.row}, {selected?.col})
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p className="text-zinc-500 dark:text-slate-400">
                GPS: {selected.lat}, {selected.lng}
              </p>
              {selected.mapPack.length === 0 ? (
                <p className="text-zinc-500 dark:text-slate-500">No map pack results for this cell.</p>
              ) : (
                <ul className="space-y-2">
                  {selected.mapPack.map(entry => (
                    <li
                      key={`${entry.rank}-${entry.title}`}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white dark:bg-blue-600">
                          {entry.rank}
                        </span>
                        <span className="font-medium">{entry.title}</span>
                      </div>
                      {entry.address && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                          {entry.address}
                        </p>
                      )}
                      {entry.rating != null && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                          {entry.rating}★ ({entry.reviews ?? 0} reviews)
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GeogridRankLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-slate-400',
        className
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-emerald-500" /> #1
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-lime-500" /> #2
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-yellow-500" /> #3
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-zinc-200 ring-2 ring-cyan-400 dark:bg-slate-700" /> N/A
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-zinc-200 ring-2 ring-cyan-400 ring-offset-1 ring-offset-white dark:bg-slate-700 dark:ring-offset-slate-900" />{' '}
        AI Visible
      </span>
    </div>
  );
}

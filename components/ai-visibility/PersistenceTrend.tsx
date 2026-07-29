'use client';

import { cn } from '@/lib/utils';
import type { SyncDotStatus } from '@/lib/ai-visibility/types';

const DOT: Record<SyncDotStatus, string> = {
  cited: 'bg-emerald-500',
  omitted: 'bg-zinc-400 dark:bg-zinc-600',
  failed: 'bg-rose-500',
  pending: 'bg-amber-400 animate-pulse',
  na: 'bg-zinc-300 dark:bg-zinc-700',
};

export default function PersistenceTrend({
  dots,
}: {
  dots: SyncDotStatus[];
}) {
  return (
    <div
      className="mt-1.5 flex items-center gap-1"
      title="Persistence trend — last 7 syncs"
      aria-label="Persistence trend last 7 syncs"
    >
      {dots.slice(0, 7).map((status, i) => (
        <span
          key={`${status}-${i}`}
          className={cn('h-1.5 w-1.5 rounded-full', DOT[status])}
        />
      ))}
    </div>
  );
}

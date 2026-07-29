'use client';

import { RefreshCw } from 'lucide-react';
import { formatCachedTimestamp } from '@/lib/analysis-cache';
import { cn } from '@/lib/utils';

type AnalysisCacheControlsProps = {
  cachedAt: number | null;
  isFromCache: boolean;
  onForceRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
};

export default function AnalysisCacheControls({
  cachedAt,
  isFromCache,
  onForceRefresh,
  isRefreshing = false,
  className,
}: AnalysisCacheControlsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {isFromCache && cachedAt ? (
        <p className="text-xs text-gray-500">
          Cached results loaded (from {formatCachedTimestamp(cachedAt)})
        </p>
      ) : cachedAt ? (
        <p className="text-xs text-gray-500">
          Last updated {formatCachedTimestamp(cachedAt)}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onForceRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-700 dark:hover:bg-blue-100"
      >
        <RefreshCw size={12} className={cn(isRefreshing && 'animate-spin')} aria-hidden />
        Force Refresh
      </button>
    </div>
  );
}

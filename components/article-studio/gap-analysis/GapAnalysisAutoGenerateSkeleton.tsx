'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function GapAnalysisAutoGenerateSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-6 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Sparkles className="h-5 w-5 animate-pulse text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Fix Gap Auto-Generation
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              AI is structuring your AEO draft…
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generating metadata, FAQ schema, executive summary, and full article body from your
              visibility gap.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-2 md:p-6">
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="mt-4 h-4 w-36" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

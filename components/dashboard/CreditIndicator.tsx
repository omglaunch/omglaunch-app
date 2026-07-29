'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUserCredits } from '@/app/actions/get-credits';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function getCreditBadgeClass(credits: number): string {
  if (credits === 0) {
    return 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300';
  }
  if (credits <= 50) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'border-border bg-background text-muted-foreground dark:bg-muted/40 dark:text-foreground';
}

export default function CreditIndicator() {
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCredits = useCallback(async () => {
    try {
      const result = await getUserCredits();
      setCredits(result?.credits ?? null);
    } catch {
      setCredits(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredits();

    function handleRefresh() {
      void loadCredits();
    }

    window.addEventListener('credits-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    return () => {
      window.removeEventListener('credits-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [loadCredits]);

  if (isLoading) {
    return (
      <Skeleton
        className="h-6 w-[7.5rem] rounded-full"
        aria-label="Loading credit balance"
      />
    );
  }

  if (credits === null) {
    return null;
  }

  return (
    <Badge
      id="tour-credit-badge"
      variant="outline"
      title={`${credits.toLocaleString()} credits remaining`}
      className={cn(
        'h-6 gap-1 rounded-full border px-2.5 py-0 text-xs font-medium shadow-none',
        getCreditBadgeClass(credits)
      )}
    >
      <span aria-hidden>⚡</span>
      <span>{credits.toLocaleString()} Credits</span>
    </Badge>
  );
}

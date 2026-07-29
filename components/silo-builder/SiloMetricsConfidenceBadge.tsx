'use client';

import { Badge } from '@/components/ui/badge';
import {
  formatMetricsConfidenceLabel,
  type SiloMetricsConfidence,
} from '@/lib/silo-builder/metrics-confidence';
import { cn } from '@/lib/utils';

type SiloMetricsConfidenceBadgeProps = {
  confidence: SiloMetricsConfidence | null | undefined;
  className?: string;
};

export default function SiloMetricsConfidenceBadge({
  confidence,
  className,
}: SiloMetricsConfidenceBadgeProps) {
  const label = formatMetricsConfidenceLabel(confidence);

  const tone =
    confidence === 'exact'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
      : confidence === 'resolved'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
        : confidence === 'unavailable'
          ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
          : 'border-border bg-muted text-muted-foreground';

  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', tone, className)}>
      {label}
    </Badge>
  );
}

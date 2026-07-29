'use client';

import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  REVERSE_ENGINEER_PROGRESS_LABELS,
  type ReverseEngineerProgressStep,
} from '@/lib/competitor-intel/constants';
import { cn } from '@/lib/utils';

const PROGRESS_STEPS: ReverseEngineerProgressStep[] = [
  'scraping',
  'analyzing',
  'architecting',
];

function progressPercent(step: ReverseEngineerProgressStep | undefined): number {
  switch (step) {
    case 'scraping':
      return 25;
    case 'analyzing':
      return 55;
    case 'architecting':
      return 80;
    case 'saving':
      return 92;
    case 'complete':
      return 100;
    default:
      return 8;
  }
}

type CompetitorPipelineProgressProps = {
  step: ReverseEngineerProgressStep | undefined;
  keywordsAnalyzed?: number | null;
};

export default function CompetitorPipelineProgress({
  step,
  keywordsAnalyzed,
}: CompetitorPipelineProgressProps) {
  const activeStep: (typeof PROGRESS_STEPS)[number] | 'saving' =
    step === 'scraping' || step === 'analyzing' || step === 'architecting'
      ? step
      : step === 'saving'
        ? 'saving'
        : 'scraping';

  const activeIndex =
    activeStep === 'saving'
      ? PROGRESS_STEPS.length
      : PROGRESS_STEPS.indexOf(activeStep);

  const percent =
    activeStep === 'saving' ? 92 : progressPercent(activeStep);

  return (
    <Card className="overflow-hidden border-emerald-500/20 bg-card shadow-lg">
      <CardHeader className="border-b border-border bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">Factory Floor</CardTitle>
            <CardDescription>
              Reverse-engineering competitor telemetry pipeline
              {keywordsAnalyzed != null && keywordsAnalyzed > 0
                ? ` · ${keywordsAnalyzed} keywords found`
                : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Pipeline progress</span>
            <span>{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {PROGRESS_STEPS.map(stepKey => {
            const stepIndex = PROGRESS_STEPS.indexOf(stepKey);
            const isActive = activeStep === stepKey;
            const isComplete = stepIndex < activeIndex;

            return (
              <div
                key={stepKey}
                className={cn(
                  'rounded-lg border px-4 py-3 transition-colors',
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : isComplete
                      ? 'border-border bg-muted/50'
                      : 'border-border/60 bg-muted/20'
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {PROGRESS_STEPS.indexOf(stepKey) + 1}
                </p>
                <p
                  className={cn(
                    'mt-1 text-sm font-medium',
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-foreground/80'
                  )}
                >
                  {REVERSE_ENGINEER_PROGRESS_LABELS[stepKey]}
                </p>
              </div>
            );
          })}
        </div>

        {activeStep === 'saving' ? (
          <p className="text-center text-sm text-muted-foreground">
            {REVERSE_ENGINEER_PROGRESS_LABELS.saving}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

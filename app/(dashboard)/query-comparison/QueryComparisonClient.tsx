'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowRight,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import { useProject } from '@/components/projects/ProjectProvider';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToolHistory } from '@/hooks/useToolHistory';
import {
  buildHistoryIdentifier,
  deriveCannibalizationRisk,
  getOverlapVisualSeverity,
  isQueryComparisonHistoryData,
  overlapSummaryText,
  type CannibalizationRisk,
  type QueryComparisonResult,
} from '@/lib/query-comparison-data';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

function cannibalizationRiskClass(risk: CannibalizationRisk): string {
  switch (risk) {
    case 'Low':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Medium':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'High':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-muted text-foreground border-border';
  }
}

function funnelStageClass(stage: string): string {
  const normalized = stage.toUpperCase();
  if (normalized === 'TOFU') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (normalized === 'MOFU') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (normalized === 'BOFU') {
    return 'bg-orange-50 text-orange-700 border-orange-200';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function overlapScoreColor(score: number): string {
  switch (getOverlapVisualSeverity(score)) {
    case 'safe':
      return 'text-muted-foreground';
    case 'caution':
      return 'text-amber-500';
    case 'collision':
      return 'text-red-500';
  }
}

function overlapRingColor(score: number): string {
  switch (getOverlapVisualSeverity(score)) {
    case 'safe':
      return 'stroke-sky-300';
    case 'caution':
      return 'stroke-amber-400';
    case 'collision':
      return 'stroke-red-500';
  }
}

function recommendationCalloutClass(intentMatch: boolean): string {
  return intentMatch
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100';
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8">
        <Skeleton className="h-36 w-36 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}

function OverlapScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-gray-100"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700 ease-out', overlapRingColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-4xl font-bold tabular-nums', overlapScoreColor(score))}>
          {score}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Overlap
        </span>
      </div>
    </div>
  );
}

function ExploreQueryButton({ label, query }: { label: string; query: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
      onClick={() => {
        router.push(`/suggested-keywords?seed=${encodeURIComponent(query)}`);
      }}
    >
      <Search className="h-3.5 w-3.5" />
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}

function ComparisonResults({ result }: { result: QueryComparisonResult }) {
  const cannibalizationRisk = deriveCannibalizationRisk(result.overlapScore, result.intentMatch);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm sm:flex-row sm:justify-center sm:gap-10">
        <OverlapScoreRing score={result.overlapScore} />
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Badge
            variant="outline"
            className={cn(
              'px-3 py-1 text-sm font-semibold',
              cannibalizationRiskClass(cannibalizationRisk)
            )}
          >
            {cannibalizationRisk} Cannibalization Risk
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'px-3 py-1 text-sm font-medium',
              result.intentMatch
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
            )}
          >
            {result.intentMatch ? 'Same Page Target' : 'Separate Page Targets'}
          </Badge>
          <p className="max-w-xs text-center text-sm text-muted-foreground sm:text-left">
            {overlapSummaryText(result.overlapScore, result.intentMatch)}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border-2 px-5 py-4 text-center sm:text-left',
          recommendationCalloutClass(result.intentMatch)
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Recommendation</p>
        <p className="mt-1 text-base font-bold leading-snug">{result.recommendation}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <ExploreQueryButton label="Explore Query A" query={result.queryA} />
        <ExploreQueryButton label="Explore Query B" query={result.queryB} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Funnel Comparison</CardTitle>
            <CardDescription className="text-xs">
              Where each query sits in the buyer journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Query A
                </p>
                <p className="truncate text-sm font-medium text-foreground">{result.queryA}</p>
              </div>
              <Badge
                variant="outline"
                className={cn('shrink-0', funnelStageClass(result.funnelComparison.queryAStage))}
              >
                {result.funnelComparison.queryAStage}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Query B
                </p>
                <p className="truncate text-sm font-medium text-foreground">{result.queryB}</p>
              </div>
              <Badge
                variant="outline"
                className={cn('shrink-0', funnelStageClass(result.funnelComparison.queryBStage))}
              >
                {result.funnelComparison.queryBStage}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              SERP Layout Expectation
            </CardTitle>
            <CardDescription className="text-xs">
              Expected search result features for these queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{result.serpLayoutExpectation}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Detailed Analysis</CardTitle>
          <CardDescription className="text-xs">
            Strategic breakdown of psychological intent and overlap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{result.detailedAnalysis}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function QueryComparisonClient() {
  const { activeProjectId } = useProject();
  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');
  const [result, setResult] = useState<QueryComparisonResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const {
    entries,
    isLoading: isHistoryLoading,
    activeId,
    save,
    remove,
    loadEntry,
    setActiveId,
  } = useToolHistory('query-comparison', {
    limit: 25,
    workspaceId: activeProjectId,
  });

  useEffect(() => {
    setResult(null);
    setSavedEntryId(null);
    setError(null);
    setActiveId(null);
  }, [activeProjectId, setActiveId]);

  const hydrateFromHistory = useCallback((data: unknown) => {
    if (!isQueryComparisonHistoryData(data)) {
      toast.error('Saved entry contains invalid data.');
      return;
    }

    setQueryA(data.queryA);
    setQueryB(data.queryB);
    setResult(data);
    setError(null);
  }, []);

  const handleLoadHistory = useCallback(
    async (id: string) => {
      try {
        const entry = await loadEntry(id);
        hydrateFromHistory(entry.resultData);
        setSavedEntryId(entry.id);
      } catch (loadError) {
        toast.error(
          loadError instanceof Error ? loadError.message : 'Failed to load saved comparison.'
        );
      }
    },
    [hydrateFromHistory, loadEntry]
  );

  const handleCompare = useCallback(async () => {
    const trimmedA = queryA.trim();
    const trimmedB = queryB.trim();

    if (!trimmedA || !trimmedB) {
      setError('Enter both queries to compare intents.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setResult(null);
    setSavedEntryId(null);
    setActiveId(null);

    try {
      const response = await fetch('/api/query-comparison/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryA: trimmedA, queryB: trimmedB }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Query comparison failed. Please try again.';
        throw new Error(message);
      }

      const generated = payload as QueryComparisonResult;
      setResult(generated);

      const saved = await save({
        id: savedEntryId ?? undefined,
        identifier: buildHistoryIdentifier(trimmedA, trimmedB),
        workspaceId: activeProjectId,
        resultData: {
          ...generated,
          projectId: activeProjectId,
        },
      });

      setSavedEntryId(saved.id);
      toast.success('Intent comparison generated and saved.');
    } catch (compareError) {
      const message =
        compareError instanceof Error
          ? compareError.message
          : 'Query comparison failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [activeProjectId, queryA, queryB, save, savedEntryId, setActiveId]);

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <ArrowLeftRight className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Query Comparison
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">Intent Overlap Analysis</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compare two search queries for intent overlap, cannibalization risk, and page targeting
            strategy. Results save automatically to your workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ToolHistoryPanel
          title="Saved Comparisons"
          description="Reload past intent analyses without re-running the AI."
          entries={entries}
          activeId={activeId}
          isLoading={isHistoryLoading}
          emptyMessage="Compare queries to build your intent analysis history."
          onLoad={entry => void handleLoadHistory(entry.id)}
          onDelete={id => {
            void remove(id);
            if (activeId === id) {
              setResult(null);
              setSavedEntryId(null);
            }
          }}
        />

        <div className="min-w-0 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Query Inputs</CardTitle>
              <CardDescription>
                Enter two search queries to analyze intent overlap and cannibalization risk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={event => {
                  event.preventDefault();
                  void handleCompare();
                }}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="query-a">Query A</Label>
                    <Input
                      id="query-a"
                      placeholder="e.g. best running shoes for flat feet"
                      value={queryA}
                      onChange={event => setQueryA(event.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="query-b">Query B</Label>
                    <Input
                      id="query-b"
                      placeholder="e.g. buy stability running shoes online"
                      value={queryB}
                      onChange={event => setQueryB(event.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isGenerating}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing Intents…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Compare Intents
                    </>
                  )}
                </Button>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </form>
            </CardContent>
          </Card>

          {isGenerating ? <ResultsSkeleton /> : null}
          {!isGenerating && result ? <ComparisonResults result={result} /> : null}
        </div>
      </div>
    </div>
  );
}

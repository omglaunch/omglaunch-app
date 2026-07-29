'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Crosshair,
  Download,
  Globe,
  LayoutGrid,
  Loader2,
  Network,
  Sparkles,
  Target,
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useProject } from '@/components/projects/ProjectProvider';
import SiloSummaryMetrics from '@/components/dashboard/SiloSummaryMetrics';
import CompetitorIntelHistorySidebar from '@/components/competitor-intel/CompetitorIntelHistorySidebar';
import type { CompetitorIntelSummary } from '@/lib/competitor-intel/persistence';
import {
  COMPETITOR_INTEL_COUNTRIES,
  DEFAULT_COMPETITOR_INTEL_COUNTRY,
  REVERSE_ENGINEER_CREDIT_COST,
  REVERSE_ENGINEER_PROGRESS_LABELS,
  type ReverseEngineerProgressStep,
} from '@/lib/competitor-intel/constants';
import type { HubSpokeMap } from '@/lib/hub-spoke-data';
import { storeHubSpokeBulkImport } from '@/lib/hub-spoke-bulk-import';
import type { SemanticGap } from '@/lib/competitor-intel/types';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

const TopicalMapVisualizer = dynamic(
  () => import('@/components/dashboard/TopicalMapVisualizer'),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[700px] w-full rounded-xl" />,
  }
);

const PROGRESS_STEPS: ReverseEngineerProgressStep[] = [
  'scraping',
  'analyzing',
  'architecting',
];

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120;

type PollResponse = {
  taskId: string;
  state: string;
  step?: ReverseEngineerProgressStep;
  error?: string;
  errorCode?: string;
  map?: HubSpokeMap;
  mapId?: string;
  semanticGaps?: SemanticGap[];
  competitorDomain?: string;
  coreNiche?: string;
  targetCountry?: string;
  keywordsAnalyzed?: number;
};

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

function FactoryFloorSkeleton({ step }: { step: ReverseEngineerProgressStep | undefined }) {
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

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
      <CardHeader className="border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base text-white">Factory Floor</CardTitle>
            <CardDescription className="text-muted-foreground">
              Reverse-engineering competitor telemetry pipeline
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Pipeline progress</span>
            <span>{activeStep === 'saving' ? 92 : progressPercent(activeStep)}%</span>
          </div>
          <Progress
            value={activeStep === 'saving' ? 92 : progressPercent(activeStep)}
            className="h-2 bg-slate-800"
          />
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
                      ? 'border-slate-700 bg-slate-900/60'
                      : 'border-slate-800 bg-slate-900/30'
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {PROGRESS_STEPS.indexOf(stepKey) + 1}
                </p>
                <p
                  className={cn(
                    'mt-1 text-sm font-medium',
                    isActive ? 'text-emerald-300' : 'text-slate-300'
                  )}
                >
                  {REVERSE_ENGINEER_PROGRESS_LABELS[stepKey]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl bg-slate-800" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SemanticGapsPanel({ gaps }: { gaps: SemanticGap[] }) {
  if (!gaps.length) {
    return null;
  }

  return (
    <Card className="border-amber-200/20 bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-950 text-slate-100 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <div>
            <CardTitle className="text-base text-white">Semantic Gaps Detected</CardTitle>
            <CardDescription className="text-muted-foreground">
              High-value sub-topics your competitor is missing — your attack vectors.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {gaps.map(gap => (
          <div
            key={gap.topic}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium text-white">{gap.topic}</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] uppercase',
                  gap.priority === 'high' && 'border-red-500/40 text-red-300',
                  gap.priority === 'medium' && 'border-amber-500/40 text-amber-300',
                  gap.priority === 'low' && 'border-slate-600 text-muted-foreground'
                )}
              >
                {gap.priority}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{gap.rationale}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MapGridPreview({ map }: { map: HubSpokeMap }) {
  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 bg-zinc-50/80 text-foreground shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-slate-100">
        <CardHeader>
          <Badge className="mb-2 w-fit border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">
            Attack Hub
          </Badge>
          <CardTitle className="text-xl text-foreground dark:text-white">{map.pillar.title}</CardTitle>
          <CardDescription className="text-emerald-600 dark:text-emerald-400">
            {map.pillar.targetKeyword}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{map.pillar.summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {map.clusters.map(cluster => (
          <Card
            key={cluster.targetKeyword}
            className="border-border bg-card text-foreground dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-slate-100"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base leading-snug text-foreground dark:text-white">
                {cluster.title}
              </CardTitle>
              <CardDescription className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {cluster.targetKeyword}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{cluster.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CompetitorIntelClient() {
  const router = useRouter();
  const projectId = useProject().activeProjectId;

  const [targetDomain, setTargetDomain] = useState('');
  const [coreNiche, setCoreNiche] = useState('');
  const [targetCountry, setTargetCountry] = useState<string>(DEFAULT_COMPETITOR_INTEL_COUNTRY);
  const [isRunning, setIsRunning] = useState(false);
  const [progressStep, setProgressStep] = useState<ReverseEngineerProgressStep | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [zeroResults, setZeroResults] = useState(false);
  const [activeMap, setActiveMap] = useState<HubSpokeMap | null>(null);
  const [semanticGaps, setSemanticGaps] = useState<SemanticGap[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [competitorDomain, setCompetitorDomain] = useState<string | null>(null);
  const [keywordsAnalyzed, setKeywordsAnalyzed] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [savedRuns, setSavedRuns] = useState<CompetitorIntelSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExportingMap, setIsExportingMap] = useState(false);
  const pollAbortRef = useRef(false);
  const exportPngRef = useRef<(() => Promise<void>) | null>(null);

  const handleExportMapReady = useCallback((exportPng: (() => Promise<void>) | null) => {
    exportPngRef.current = exportPng;
  }, []);

  const handleExportMapPng = useCallback(async () => {
    if (!exportPngRef.current) {
      toast.error('Map export is not ready yet.');
      return;
    }
    setIsExportingMap(true);
    try {
      await exportPngRef.current();
    } finally {
      setIsExportingMap(false);
    }
  }, []);

  const fetchSavedRuns = useCallback(async () => {
    const response = await fetch(
      `/api/competitor-intel/list?workspaceId=${encodeURIComponent(projectId)}`
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String(payload.error)
          : 'Failed to load saved reports.';
      throw new Error(message);
    }

    const runs =
      typeof payload === 'object' && payload !== null && 'runs' in payload
        ? (payload.runs as CompetitorIntelSummary[])
        : [];

    setSavedRuns(runs);
    return runs;
  }, [projectId]);

  const loadRunById = useCallback(
    async (id: string) => {
      setIsLoadingRun(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/competitor-intel/${id}?workspaceId=${encodeURIComponent(projectId)}`
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String(payload.error)
              : 'Failed to load report.';
          throw new Error(message);
        }

        const run =
          typeof payload === 'object' && payload !== null && 'run' in payload
            ? (payload.run as {
                id: string;
                map: HubSpokeMap;
                semanticGaps: SemanticGap[];
                competitorDomain: string | null;
                coreNiche: string | null;
                targetCountry: string;
                keywordsAnalyzed: number | null;
              })
            : null;

        if (!run) {
          throw new Error('Report returned invalid data.');
        }

        setActiveRunId(run.id);
        setActiveMap(run.map);
        setSemanticGaps(run.semanticGaps ?? []);
        setCompetitorDomain(run.competitorDomain);
        setCoreNiche(run.coreNiche ?? '');
        setTargetCountry(run.targetCountry);
        setTargetDomain(run.competitorDomain ?? '');
        setKeywordsAnalyzed(run.keywordsAnalyzed);
        setZeroResults(false);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load report.';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoadingRun(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    setIsLoadingList(true);
    void (async () => {
      try {
        await fetchSavedRuns();
      } catch (listError) {
        toast.error(
          listError instanceof Error ? listError.message : 'Failed to load saved reports.'
        );
      } finally {
        setIsLoadingList(false);
      }
    })();
  }, [fetchSavedRuns]);

  async function handleDeleteRun(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    setDeletingId(id);

    try {
      const response = await fetch(
        `/api/competitor-intel/delete/${id}?workspaceId=${encodeURIComponent(projectId)}`,
        { method: 'DELETE' }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to delete report.';
        throw new Error(message);
      }

      setSavedRuns(prev => prev.filter(run => run.id !== id));

      if (activeRunId === id) {
        setActiveRunId(null);
        setActiveMap(null);
        setSemanticGaps([]);
        setCompetitorDomain(null);
        setKeywordsAnalyzed(null);
      }

      toast.success('Report deleted.');
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete report.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  const resultSummary = useMemo(() => {
    if (!activeMap) {
      return null;
    }

    return {
      clusters: activeMap.clusters.length,
      gaps: semanticGaps.length,
    };
  }, [activeMap, semanticGaps.length]);

  const pollTaskUntilComplete = useCallback(async (taskId: string): Promise<PollResponse> => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      if (pollAbortRef.current) {
        throw new Error('Polling cancelled.');
      }

      const response = await fetch(
        `/api/reverse-engineer?taskId=${encodeURIComponent(taskId)}`
      );
      const payload = (await response.json().catch(() => ({}))) as PollResponse;

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to poll task status.';
        throw new Error(message);
      }

      if (payload.step) {
        setProgressStep(payload.step);
      }

      if (payload.keywordsAnalyzed != null) {
        setKeywordsAnalyzed(payload.keywordsAnalyzed);
      }

      if (payload.state === 'FAILED') {
        if (payload.errorCode === 'ZERO_COMPETITOR_KEYWORDS') {
          setZeroResults(true);
        }
        throw new Error(payload.error ?? 'Reverse-engineer task failed.');
      }

      if (payload.state === 'COMPLETED' && payload.map) {
        return payload;
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error('Task timed out while waiting for completion.');
  }, []);

  useEffect(() => {
    return () => {
      pollAbortRef.current = true;
    };
  }, []);

  async function handleReverseEngineer() {
    const trimmedDomain = targetDomain.trim();
    const trimmedNiche = coreNiche.trim();

    if (!trimmedDomain) {
      setError('Enter a competitor domain to deconstruct.');
      return;
    }

    if (!trimmedNiche) {
      setError('Enter a core niche to anchor the attack strategy.');
      return;
    }

    setError(null);
    setZeroResults(false);
    setIsRunning(true);
    setProgressStep('queued');
    setActiveMap(null);
    setSemanticGaps([]);
    setActiveRunId(null);
    setCompetitorDomain(null);
    setKeywordsAnalyzed(null);
    pollAbortRef.current = false;

    try {
      const response = await fetch('/api/reverse-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDomain: trimmedDomain,
          coreNiche: trimmedNiche,
          targetCountry,
          workspaceId: projectId,
          projectId,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as PollResponse & {
        completed?: boolean;
      };

      if (response.status === 402) {
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : 'Insufficient credits to reverse-engineer competitor.';
        toast.error(message);
        setError(message);
        return;
      }

      if (response.status === 422 || payload.errorCode === 'ZERO_COMPETITOR_KEYWORDS') {
        setZeroResults(true);
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : 'No ranked keywords found for this domain.';
        setError(message);
        toast.error(message);
        return;
      }

      if (!response.ok) {
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : 'Reverse-engineer request failed.';
        throw new Error(message);
      }

      let result = payload;

      if (!payload.completed && payload.taskId) {
        result = await pollTaskUntilComplete(payload.taskId);
      }

      if (!result.map) {
        throw new Error('Completed task returned no map data.');
      }

      setActiveMap(result.map);
      setSemanticGaps(result.semanticGaps ?? []);
      setActiveRunId(result.mapId ?? null);
      setCompetitorDomain(result.competitorDomain ?? trimmedDomain);
      setKeywordsAnalyzed(result.keywordsAnalyzed ?? null);
      setProgressStep('complete');
      try {
        await fetchSavedRuns();
      } catch {
        // list refresh is best-effort after create
      }
      toast.success('Competitor attack map architected and saved.');
    } catch (runError) {
      const message =
        runError instanceof Error
          ? runError.message
          : 'Reverse-engineer failed. Please try again.';
      setError(message);
      if (!zeroResults) {
        toast.error(message);
      }
    } finally {
      setIsRunning(false);
      window.dispatchEvent(new Event('credits-updated'));
    }
  }

  function handleExportToWordPress() {
    if (!activeMap) {
      return;
    }

    storeHubSpokeBulkImport(
      activeMap.clusters.map(cluster => ({
        targetKeyword: cluster.targetKeyword,
        title: cluster.title,
      }))
    );
    router.push('/article-studio?bulkImport=hub-spoke');
    toast.success('Spokes queued for Article Studio — publish to WordPress from there.');
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-6 overflow-x-hidden lg:flex-row">
      <CompetitorIntelHistorySidebar
        runs={savedRuns}
        activeRunId={activeRunId}
        isLoading={isLoadingList}
        isLoadingRun={isLoadingRun}
        deletingId={deletingId}
        onSelect={id => void loadRunById(id)}
        onDelete={(id, event) => void handleDeleteRun(id, event)}
      />

      <div className="min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
        <div className="w-full min-w-0 space-y-8">
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:p-6 dark:shadow-2xl sm:p-6 dark:sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Crosshair className="h-3.5 w-3.5" />
              Competitor Intel
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
              Deconstruct the Competition
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-muted-foreground">
              Scrape a rival&apos;s organic footprint, prune their keyword telemetry, and
              architect a superior Hub &amp; Spoke attack map that exploits their semantic
              gaps. Costs {REVERSE_ENGINEER_CREDIT_COST} credits per run.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
            <Target className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <form
          className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={event => {
            event.preventDefault();
            void handleReverseEngineer();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="targetDomain" className="text-zinc-700 dark:text-slate-300">
              Competitor Domain
            </Label>
            <Input
              id="targetDomain"
              placeholder="competitor.com"
              value={targetDomain}
              onChange={event => setTargetDomain(event.target.value)}
              disabled={isRunning}
              className="border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coreNiche" className="text-zinc-700 dark:text-slate-300">
              Core Niche
            </Label>
            <Input
              id="coreNiche"
              placeholder="SaaS Marketing"
              value={coreNiche}
              onChange={event => setCoreNiche(event.target.value)}
              disabled={isRunning}
              className="border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetCountry" className="text-zinc-700 dark:text-slate-300">
              Target Country
            </Label>
            <Select
              value={targetCountry}
              onValueChange={setTargetCountry}
              disabled={isRunning}
            >
              <SelectTrigger
                id="targetCountry"
                className="border-zinc-300 bg-white text-zinc-900 focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                {COMPETITOR_INTEL_COUNTRIES.map(country => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isRunning}
              className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Pipeline…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Reverse-Engineer Strategy
                </>
              )}
            </Button>
          </div>
        </form>

        {error && (
          <div
            className={cn(
              'mt-4 rounded-lg border px-4 py-3 text-sm',
              zeroResults
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            )}
            role="alert"
          >
            {zeroResults ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Zero Results</p>
                  <p className="mt-1 text-amber-100/90">{error}</p>
                </div>
              </div>
            ) : (
              error
            )}
          </div>
        )}
      </section>

      {isRunning && <FactoryFloorSkeleton step={progressStep} />}

      {isLoadingRun && !isRunning && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading report…
        </div>
      )}

      {activeMap && !isRunning && !isLoadingRun && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Attack map ready</p>
              <p className="text-xs text-muted-foreground">
                {competitorDomain && (
                  <>
                    <Globe className="mr-1 inline h-3.5 w-3.5" />
                    {competitorDomain}
                    {' · '}
                  </>
                )}
                {keywordsAnalyzed != null && `${keywordsAnalyzed} keywords analyzed`}
                {resultSummary && ` · ${resultSummary.clusters} spokes · ${resultSummary.gaps} gaps`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (activeRunId) {
                    router.push(`/dashboard/silo-builder?import=${activeRunId}`);
                  }
                }}
                disabled={!activeRunId}
                className="gap-2"
              >
                Continue in Silo Builder
                <ArrowRight className="h-4 w-4" />
              </Button>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={value => {
                  if (value === 'grid' || value === 'map') {
                    setViewMode(value);
                  }
                }}
                variant="outline"
                size="sm"
                className="rounded-lg border border-border bg-card p-1 shadow-sm"
              >
                <ToggleGroupItem
                  value="grid"
                  aria-label="Grid view"
                  className="gap-1.5 px-3 data-[state=on]:border-emerald-200 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-800 dark:data-[state=on]:border-emerald-500/40 dark:data-[state=on]:bg-emerald-500/10 dark:data-[state=on]:text-emerald-400"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Grid
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="map"
                  aria-label="Map view"
                  className="gap-1.5 px-3 data-[state=on]:border-emerald-200 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-800 dark:data-[state=on]:border-emerald-500/40 dark:data-[state=on]:bg-emerald-500/10 dark:data-[state=on]:text-emerald-400"
                >
                  <Network className="h-3.5 w-3.5" />
                  Node Graph
                </ToggleGroupItem>
              </ToggleGroup>

              {viewMode === 'map' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleExportMapPng()}
                  disabled={isExportingMap}
                  className="gap-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200"
                >
                  {isExportingMap ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export Map as PNG
                </Button>
              ) : null}

              <Button
                type="button"
                onClick={handleExportToWordPress}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500"
              >
                Export to WordPress
              </Button>
            </div>
          </div>

          <SemanticGapsPanel gaps={semanticGaps} />
          <SiloSummaryMetrics map={activeMap} />

          {viewMode === 'grid' ? (
            <MapGridPreview map={activeMap} />
          ) : (
            <TopicalMapVisualizer
              map={activeMap}
              onExportReady={handleExportMapReady}
            />
          )}
        </>
      )}

      {!isRunning && !activeMap && !error && !isLoadingRun && (
        <Card className="border-dashed border-border bg-card/80">
          <CardContent className="py-16 text-center">
            <Crosshair className="mx-auto mb-4 h-10 w-10 text-emerald-400/60" />
            <p className="text-sm font-medium text-muted-foreground">No attack map yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter a competitor domain and core niche to reverse-engineer their strategy, or
              select a saved report from the sidebar.
            </p>
          </CardContent>
        </Card>
      )}
        </div>
      </div>
    </div>
  );
}

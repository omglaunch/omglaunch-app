'use client';

import dynamic from 'next/dynamic';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchPageAnalysis } from '@/lib/analysis/client-api';
import { useProject } from '@/components/projects/ProjectProvider';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import AppMain from '@/components/layout/AppMain';
import { useToolHistory } from '@/hooks/useToolHistory';
import {
  buildImprovementSubtext,
  getScoreBarVariant,
  overallScoreBarFillClass,
  overallScoreRingStrokeColor,
  overallScoreTextClass,
  scoreBarFillClass,
  scoreBarTextClass,
  type AnalysisMetrics,
} from '@/lib/analysis-data';
import { formatCachedTimestamp, normalizeAnalysisUrl } from '@/lib/analysis-cache';
import {
  buildAnalysisIdentifier,
  loadLatestAnalysisFromHistory,
  persistAnalysisToHistory,
} from '@/lib/tool-history/analysis-persistence';
import { fetchToolHistoryEntry } from '@/lib/tool-history/client';
import { cn } from '@/lib/utils';

const AnalysisDownloadPdfButton = dynamic(() => import('./AnalysisDownloadPdfButton'), {
  ssr: false,
});

const DEFAULT_URL = 'https://example.com';

function isValidAnalysisMetrics(data: unknown): data is AnalysisMetrics {
  if (!data || typeof data !== 'object') return false;

  const metrics = data as AnalysisMetrics;
  return (
    typeof metrics.url === 'string' &&
    typeof metrics.overallScore === 'number' &&
    Number.isFinite(metrics.overallScore) &&
    typeof metrics.summaryText === 'string' &&
    Array.isArray(metrics.checks)
  );
}

function isDefaultAnalysisUrl(url: string): boolean {
  return normalizeAnalysisUrl(url) === normalizeAnalysisUrl(DEFAULT_URL);
}

type RunAnalysisOptions = {
  forceRefresh?: boolean;
};

function GeoScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (clampedScore / 100) * circumference;
  const scoreLabel = score.toFixed(1);

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        GEO score of the page
      </p>

      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg
          width="144"
          height="144"
          viewBox="0 0 144 144"
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="10"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke={overallScoreRingStrokeColor(score)}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'text-3xl font-bold tabular-nums',
              overallScoreTextClass(score)
            )}
          >
            {scoreLabel}%
          </span>
        </div>
      </div>

      <div className="w-full">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Score</span>
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              overallScoreTextClass(score)
            )}
          >
            {scoreLabel}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              overallScoreBarFillClass(score)
            )}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type AnalysisAIClientProps = {
  initialUrl?: string;
};

export default function AnalysisAIClient({
  initialUrl = DEFAULT_URL,
}: AnalysisAIClientProps) {
  const { activeProjectId } = useProject();
  const {
    entries: historyEntries,
    isLoading: isHistoryLoading,
    activeId,
    setActiveId,
    remove: removeHistoryEntry,
    refresh: refreshHistory,
  } = useToolHistory('analysis-ai', {
    importLocal: true,
    limit: 25,
    workspaceId: activeProjectId,
  });

  const [url, setUrl] = useState(initialUrl);
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [activeIdentifier, setActiveIdentifier] = useState<string | null>(null);

  const runAnalysis = useCallback(async (targetUrl: string, options?: RunAnalysisOptions) => {
    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) {
      setError('Please enter a URL to analyze.');
      return;
    }

    const identifier = buildAnalysisIdentifier(trimmedUrl);

    if (!options?.forceRefresh) {
      if (metrics && activeIdentifier === identifier) {
        return;
      }

      try {
        const cached = await loadLatestAnalysisFromHistory({
          tool: 'analysis-ai',
          identifier,
          validate: isValidAnalysisMetrics,
          workspaceId: activeProjectId,
        });

        if (cached) {
          setMetrics(cached.data);
          setUrl(cached.data.url);
          setCachedAt(cached.timestamp);
          setIsFromCache(true);
          setActiveIdentifier(identifier);
          setActiveId(cached.historyId);
          setError(null);
          setIsAnalyzing(false);
          return;
        }
      } catch {
        // Fall through to fresh analysis.
      }
    } else {
      setMetrics(null);
      setCachedAt(null);
      setIsFromCache(false);
      setActiveIdentifier(null);
      setActiveId(null);
    }

    setError(null);
    setIsAnalyzing(true);
    setIsFromCache(false);

    try {
      const result = await fetchPageAnalysis(trimmedUrl);

      if (!isValidAnalysisMetrics(result)) {
        throw new Error('Invalid analysis response');
      }

      const timestamp = Date.now();
      const historyId = await persistAnalysisToHistory({
        tool: 'analysis-ai',
        identifier,
        data: result,
        url: result.url,
        workspaceId: activeProjectId,
      });

      setMetrics(result);
      setUrl(result.url);
      setCachedAt(timestamp);
      setIsFromCache(false);
      setActiveIdentifier(identifier);
      setActiveId(historyId);
      await refreshHistory();
    } catch {
      setError('Failed to analyze the page. Check the URL and try again.');
      setMetrics(null);
      setCachedAt(null);
      setActiveIdentifier(null);
      setActiveId(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeIdentifier, activeProjectId, metrics, refreshHistory, setActiveId]);

  useEffect(() => {
    setMetrics(null);
    setCachedAt(null);
    setIsFromCache(false);
    setActiveIdentifier(null);
    setActiveId(null);
    setError(null);
  }, [activeProjectId, setActiveId]);

  const handleForceRefresh = useCallback(() => {
    if (!url.trim()) return;

    setMetrics(null);
    setCachedAt(null);
    setIsFromCache(false);
    setActiveIdentifier(null);
    setActiveId(null);
    setError(null);

    void runAnalysis(url, { forceRefresh: true });
  }, [runAnalysis, setActiveId, url]);

  const handleLoadHistory = useCallback(
    async (entryId: string) => {
      const entry = await fetchToolHistoryEntry('analysis-ai', entryId, activeProjectId);
      const payload = entry.resultData;

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('data' in payload) ||
        !isValidAnalysisMetrics((payload as { data: unknown }).data)
      ) {
        return;
      }

      const stored = payload as unknown as { data: AnalysisMetrics; timestamp?: number };
      setMetrics(stored.data);
      setUrl(stored.data.url);
      setCachedAt(stored.timestamp ?? Date.parse(entry.createdAt));
      setIsFromCache(true);
      setActiveIdentifier(entry.identifier);
      setActiveId(entry.id);
      setError(null);
    },
    [activeProjectId, setActiveId]
  );

  const improvementSubtext = metrics
    ? buildImprovementSubtext(metrics.checks)
    : '';

  return (
    <AppMain>
      <div className="min-h-full p-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-foreground">
                Analysis AI Ready of{' '}
                {metrics ? (
                  <span className="font-mono text-emerald-600 dark:text-blue-600">{metrics.url}</span>
                ) : (
                  <span className="font-mono text-muted-foreground">…</span>
                )}
              </h1>
              {metrics && isFromCache && cachedAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cached results loaded (from {formatCachedTimestamp(cachedAt)})
                </p>
              ) : null}
              <form
                className="mt-3 flex max-w-2xl gap-2"
                onSubmit={event => {
                  event.preventDefault();
                  runAnalysis(url);
                }}
              >
                <input
                  type="url"
                  value={url}
                  onChange={event => setUrl(event.target.value)}
                  placeholder="https://example.com/page"
                  disabled={isAnalyzing}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:focus:border-blue-400 dark:focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {isAnalyzing ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : null}
                  Analyze
                </button>
              </form>
              {error ? (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {metrics ? (
                <AnalysisDownloadPdfButton metrics={metrics} disabled={isAnalyzing} />
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 opacity-60 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-700"
                >
                  Download the PDF
                </button>
              )}
              <button
                type="button"
                disabled={isAnalyzing || !metrics}
                onClick={handleForceRefresh}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {isAnalyzing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                Relaunch the analysis
              </button>
            </div>
          </div>

          <div className="mb-6">
            <ToolHistoryPanel
              title="Recent Analysis AI Runs"
              entries={historyEntries}
              activeId={activeId}
              isLoading={isHistoryLoading}
              onLoad={entry => void handleLoadHistory(entry.id)}
              onDelete={id => void removeHistoryEntry(id)}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {isAnalyzing && !metrics ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-muted-foreground">
                <Loader2 size={28} className="animate-spin text-emerald-600 dark:text-blue-600" />
                <p className="text-sm">Analyzing page AI-readiness…</p>
              </div>
            ) : metrics ? (
              <div
                className={cn(
                  'grid grid-cols-1 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0',
                  isAnalyzing && 'opacity-60 transition-opacity'
                )}
              >
                <div className="flex flex-col gap-5 p-6 lg:col-span-1">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <GeoScoreGauge score={metrics.overallScore} />
                  </div>

                  <div className="space-y-2 px-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {metrics.summaryText}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {improvementSubtext}
                    </p>
                  </div>
                </div>

                <div className="p-6 lg:col-span-2">
                  <div className="space-y-4">
                    {metrics.checks.map(check => {
                      const variant = getScoreBarVariant(check.score);

                      return (
                        <div
                          key={check.question}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-4"
                        >
                          <p className="text-sm text-foreground">{check.question}</p>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                scoreBarFillClass(variant)
                              )}
                              style={{ width: `${check.score}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              'w-12 text-right text-sm font-semibold tabular-nums',
                              scoreBarTextClass(variant)
                            )}
                          >
                            {check.score}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-muted-foreground">
                <p className="text-sm">
                  {isDefaultAnalysisUrl(url)
                    ? 'Enter a URL and click Analyze to run an AI-readiness check.'
                    : 'Click Analyze to run an AI-readiness check for this URL.'}
                </p>
              </div>
            )}
          </div>
      </div>
    </AppMain>
  );
}

'use client';

import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Microscope, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { runFullSeoAnalysis } from '@/app/actions/seo-analysis';
import AnalysisCacheControls from '@/components/analysis/AnalysisCacheControls';
import { useProject } from '@/components/projects/ProjectProvider';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';
import {
  overallScoreBarFillClass,
  overallScoreTextClass,
} from '@/lib/analysis-data';
import { readSearchParamsFromWindow } from '@/lib/analysis-cache';
import {
  buildAnalysisIdentifier,
  loadLatestAnalysisFromHistory,
  persistAnalysisToHistory,
} from '@/lib/tool-history/analysis-persistence';
import { fetchToolHistoryEntry } from '@/lib/tool-history/client';
import {
  seoStatusTextClass,
  type SeoAnalysisMetrics,
  type SeoCriterionStatus,
} from '@/lib/seo-analysis-data';
import { cn } from '@/lib/utils';
import SummaryVisuals from './SummaryVisuals';

function StatusIcon({ status }: { status: SeoCriterionStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Pass" />;
    case 'warning':
      return (
        <AlertTriangle className="h-5 w-5 text-amber-500" aria-label="Warning" />
      );
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-500" aria-label="Fail" />;
    default:
      return null;
  }
}

function buildSemanticAnalysisHref(pageUrl: string, keyword: string): string {
  const params = new URLSearchParams({ url: pageUrl, keyword });
  return `/semantic-analysis?${params.toString()}`;
}

function isValidSeoMetrics(data: unknown): data is SeoAnalysisMetrics {
  if (!data || typeof data !== 'object') return false;

  const metrics = data as SeoAnalysisMetrics;
  return (
    typeof metrics.url === 'string' &&
    typeof metrics.overallScore === 'number' &&
    Number.isFinite(metrics.overallScore) &&
    Array.isArray(metrics.criteria) &&
    Array.isArray(metrics.keywordFrequencies)
  );
}

type RunAnalysisOptions = {
  forceRefresh?: boolean;
};

export default function SeoAnalysisClient() {
  const { activeProjectId } = useProject();
  const { url: initialUrl, keyword: initialKeyword } = readSearchParamsFromWindow();
  const {
    entries: historyEntries,
    isLoading: isHistoryLoading,
    activeId,
    setActiveId,
    remove: removeHistoryEntry,
    refresh: refreshHistory,
  } = useToolHistory('seo-analysis', {
    importLocal: true,
    limit: 25,
    workspaceId: activeProjectId,
  });

  const [url, setUrl] = useState(initialUrl);
  const [targetKeyword, setTargetKeyword] = useState(initialKeyword);
  const [metrics, setMetrics] = useState<SeoAnalysisMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [activeIdentifier, setActiveIdentifier] = useState<string | null>(null);
  const didAttemptAutoRun = useRef(false);

  const applyMetrics = useCallback(
    (result: SeoAnalysisMetrics, keyword: string, timestamp: number, fromCache: boolean) => {
      setMetrics(result);
      setUrl(result.url);
      setTargetKeyword(keyword);
      setCachedAt(timestamp);
      setIsFromCache(fromCache);
      setActiveIdentifier(buildAnalysisIdentifier(result.url, keyword));
    },
    []
  );

  const runAnalysis = useCallback(
    async (targetUrl: string, keyword?: string, options?: RunAnalysisOptions) => {
      const trimmedUrl = targetUrl.trim();
      const trimmedKeyword = keyword?.trim() ?? '';

      if (!trimmedUrl) {
        setError('Please enter a URL to analyze.');
        return;
      }

      const identifier = buildAnalysisIdentifier(trimmedUrl, trimmedKeyword);

      if (!options?.forceRefresh) {
        if (metrics && activeIdentifier === identifier) {
          return;
        }

        try {
          const cached = await loadLatestAnalysisFromHistory({
            tool: 'seo-analysis',
            identifier,
            validate: isValidSeoMetrics,
            workspaceId: activeProjectId,
          });

          if (cached) {
            applyMetrics(
              cached.data,
              cached.keyword || trimmedKeyword,
              cached.timestamp,
              true
            );
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
        const result = await runFullSeoAnalysis(
          trimmedUrl,
          trimmedKeyword || undefined
        );

        if (!isValidSeoMetrics(result)) {
          throw new Error('Invalid analysis response');
        }

        const timestamp = Date.now();
        const historyId = await persistAnalysisToHistory({
          tool: 'seo-analysis',
          identifier,
          data: result,
          url: result.url,
          keyword: trimmedKeyword,
          workspaceId: activeProjectId,
        });

        applyMetrics(result, trimmedKeyword, timestamp, false);
        setActiveId(historyId);
        setActiveIdentifier(identifier);
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
    },
    [activeIdentifier, applyMetrics, activeProjectId, metrics, refreshHistory, setActiveId]
  );

  useEffect(() => {
    setMetrics(null);
    setCachedAt(null);
    setIsFromCache(false);
    setActiveIdentifier(null);
    setActiveId(null);
    setError(null);
    didAttemptAutoRun.current = false;
  }, [activeProjectId, setActiveId]);

  useEffect(() => {
    if (didAttemptAutoRun.current || isHistoryLoading || metrics || !url.trim()) {
      return;
    }

    didAttemptAutoRun.current = true;
    void runAnalysis(url, targetKeyword);
  }, [activeProjectId, isHistoryLoading, metrics, runAnalysis, targetKeyword, url]);

  const handleForceRefresh = useCallback(() => {
    if (!url.trim()) return;

    setMetrics(null);
    setCachedAt(null);
    setIsFromCache(false);
    setActiveIdentifier(null);
    setActiveId(null);
    setError(null);

    void runAnalysis(url, targetKeyword, { forceRefresh: true });
  }, [runAnalysis, setActiveId, targetKeyword, url]);

  const handleLoadHistory = useCallback(
    async (entryId: string) => {
      const entry = await fetchToolHistoryEntry('seo-analysis', entryId, activeProjectId);
      const payload = entry.resultData;

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('data' in payload) ||
        !isValidSeoMetrics((payload as { data: unknown }).data)
      ) {
        return;
      }

      const stored = payload as unknown as {
        data: SeoAnalysisMetrics;
        keyword?: string;
        timestamp?: number;
      };

      applyMetrics(
        stored.data,
        stored.keyword ?? targetKeyword,
        stored.timestamp ?? Date.parse(entry.createdAt),
        true
      );
      setActiveId(entry.id);
      setActiveIdentifier(entry.identifier);
      setError(null);
    },
    [applyMetrics, activeProjectId, setActiveId, targetKeyword]
  );

  const clampedScore = metrics
    ? Math.min(Math.max(metrics.overallScore, 0), 100)
    : 0;

  const resolvedKeyword =
    metrics?.criteria.find(criterion => criterion.id === 'target-keyword')?.value?.toString() ??
    targetKeyword.trim();

  const canLinkToSemantic =
    Boolean(metrics?.url) &&
    Boolean(resolvedKeyword) &&
    resolvedKeyword !== 'unknown';

  return (
    <div className="min-w-0 max-w-full space-y-8 overflow-x-hidden">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 lg:max-w-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                  SEO analysis of the page
                </h1>
                {metrics ? (
                  <AnalysisCacheControls
                    cachedAt={cachedAt}
                    isFromCache={isFromCache}
                    onForceRefresh={handleForceRefresh}
                    isRefreshing={isAnalyzing}
                    className="sm:pt-1"
                  />
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Find here a quick analysis of the important SEO criteria of your page.
                These are technical and editorial &apos;onpage&apos; criteria, technical
                performance and semantic coverage are treated separately.
              </p>

              <form
                className="mt-5 flex w-full min-w-0 max-w-2xl flex-col gap-2 sm:flex-row"
                onSubmit={event => {
                  event.preventDefault();
                  didAttemptAutoRun.current = true;
                  void runAnalysis(url, targetKeyword);
                }}
              >
                <input
                  type="url"
                  value={url}
                  onChange={event => setUrl(event.target.value)}
                  placeholder="https://example.com/page"
                  disabled={isAnalyzing}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:focus:border-blue-400 dark:focus:ring-blue-100"
                />
                <input
                  type="text"
                  value={targetKeyword}
                  onChange={event => setTargetKeyword(event.target.value)}
                  placeholder="Target Keyword (Optional)"
                  disabled={isAnalyzing}
                  className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:focus:border-blue-400 dark:focus:ring-blue-100 sm:w-52"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {isAnalyzing ? <Loader2 size={15} className="animate-spin" /> : null}
                  Analyze
                </button>
              </form>
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            </div>

            {metrics ? (
              <div className="w-full min-w-0 shrink-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:w-72">
                <p className="text-sm font-medium text-foreground">SEO score of the page</p>
                <p
                  className={cn(
                    'mt-2 text-4xl font-bold tabular-nums',
                    overallScoreTextClass(metrics.overallScore)
                  )}
                >
                  {metrics.overallScore.toFixed(1)}%
                </p>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      overallScoreBarFillClass(metrics.overallScore)
                    )}
                    style={{ width: `${clampedScore}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {isAnalyzing && !metrics ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-24 text-muted-foreground shadow-sm">
              <Loader2 size={28} className="animate-spin text-emerald-600 dark:text-blue-600" />
              <p className="text-sm">Analyzing page SEO criteria…</p>
            </div>
          ) : null}

          {metrics ? (
            <SummaryVisuals
              resolvedKeyword={resolvedKeyword}
              keywordFrequencies={metrics.keywordFrequencies}
              onRescan={handleForceRefresh}
              isScanning={isAnalyzing}
            />
          ) : null}

          {metrics ? (
            <>
              <div className="space-y-3 md:hidden">
                {metrics.criteria.map(criterion => (
                  <article
                    key={criterion.id}
                    className={cn(
                      'rounded-xl border border-border bg-card p-4 shadow-sm',
                      isAnalyzing && 'opacity-60 transition-opacity'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {criterion.label}
                      </p>
                      <StatusIcon status={criterion.status} />
                    </div>
                    <div className="mt-3 space-y-1">
                      {criterion.value !== '' && criterion.value !== undefined ? (
                        <p className="break-words text-sm text-foreground">{criterion.value}</p>
                      ) : null}
                      {criterion.subtext ? (
                        <p
                          className={cn(
                            'text-sm italic leading-relaxed',
                            seoStatusTextClass(criterion.status)
                          )}
                        >
                          {criterion.subtext}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div
                className={cn(
                  'hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block',
                  isAnalyzing && 'opacity-60 transition-opacity'
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/80">
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:px-5"
                        >
                          Criterion analysed
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:px-5"
                        >
                          Value
                        </th>
                        <th
                          scope="col"
                          className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:px-5"
                        >
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.criteria.map((criterion, index) => (
                        <tr
                          key={criterion.id}
                          className={cn(
                            'border-b border-border last:border-b-0',
                            index % 2 === 1 && 'bg-muted'
                          )}
                        >
                          <td className="px-4 py-4 align-top text-foreground lg:px-5">
                            {criterion.label}
                          </td>
                          <td className="px-4 py-4 align-top lg:px-5">
                            {criterion.value !== '' && criterion.value !== undefined ? (
                              <p className="break-words text-foreground">{criterion.value}</p>
                            ) : null}
                            {criterion.subtext ? (
                              <p
                                className={cn(
                                  'text-sm italic leading-relaxed',
                                  criterion.value !== '' && criterion.value !== undefined
                                    ? 'mt-1'
                                    : '',
                                  seoStatusTextClass(criterion.status)
                                )}
                              >
                                {criterion.subtext}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-center align-top lg:px-5">
                            <div className="flex justify-center">
                              <StatusIcon status={criterion.status} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {metrics ? (
            <div className="min-w-0 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm dark:border-blue-100 dark:from-blue-50 dark:to-indigo-50 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white dark:bg-blue-600">
                    <Microscope size={20} aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Need deep content insights?
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      View the full Semantic Analysis report for this URL — competitive keyword
                      benchmarks, TF-IDF scoring, and semantic suggestions.
                    </p>
                  </div>
                </div>
                {canLinkToSemantic ? (
                  <Link
                    href={buildSemanticAnalysisHref(metrics.url, resolvedKeyword)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    View Full Report
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Run analysis with a target keyword to open the full report.
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <ToolHistoryPanel
          title="Recent SEO Analyses"
          entries={historyEntries}
          activeId={activeId}
          isLoading={isHistoryLoading}
          onLoad={entry => void handleLoadHistory(entry.id)}
          onDelete={id => void removeHistoryEntry(id)}
        />
        </div>
      </div>
    </div>
  );
}

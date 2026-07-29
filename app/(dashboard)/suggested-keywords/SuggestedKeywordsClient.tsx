'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ListPlus, Loader2, Sparkles } from 'lucide-react';
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
import { ANALYSIS_LOCATION_OPTIONS } from '@/lib/analysis-state';
import {
  isSuggestedKeywordsHistoryData,
  type SuggestedKeywordsResult,
} from '@/lib/suggested-keywords-data';
import { buildSiloBuilderHref } from '@/lib/silo-builder/deep-link';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

type SortDirection = 'asc' | 'desc';

const ALL_FILTER = 'all';

function intentBadgeClass(intent: string): string {
  switch (intent) {
    case 'Informational':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50';
    case 'Commercial':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
    case 'Transactional':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50';
    case 'Navigational':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function funnelStageBadgeClass(stage: string): string {
  const normalized = stage.toUpperCase();
  if (normalized === 'TOFU') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
  }
  if (normalized === 'MOFU') {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50';
  }
  if (normalized === 'BOFU') {
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function difficultyBadgeClass(difficulty: string): string {
  switch (difficulty) {
    case 'Low':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
    case 'Medium':
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50';
    case 'High':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function buildHistoryIdentifier(seedKeyword: string, location: string): string {
  const trimmed = seedKeyword.trim();
  if (!location || location === 'Global (USA)') {
    return trimmed;
  }
  return `${trimmed} · ${location}`;
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/80 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildClusterButton({
  keyword,
  geography,
}: {
  keyword: string;
  geography: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 border-emerald-200 px-2.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
      onClick={() => {
        router.push(
          buildSiloBuilderHref({
            seed: keyword,
            geography,
            mode: 'quick',
          })
        );
      }}
    >
      Build Cluster
      <ArrowRight className="h-3 w-3" />
    </Button>
  );
}

export default function SuggestedKeywordsClient() {
  const { activeProjectId } = useProject();
  const [seedKeyword, setSeedKeyword] = useState('');
  const [location, setLocation] = useState('Malaysia');
  const [result, setResult] = useState<SuggestedKeywordsResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState(ALL_FILTER);
  const [funnelFilter, setFunnelFilter] = useState(ALL_FILTER);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const {
    entries,
    isLoading: isHistoryLoading,
    activeId,
    save,
    remove,
    loadEntry,
    setActiveId,
  } = useToolHistory('suggested-keywords', {
    limit: 25,
    workspaceId: activeProjectId,
  });

  useEffect(() => {
    setResult(null);
    setSavedEntryId(null);
    setError(null);
    setKeywordFilter('');
    setIntentFilter(ALL_FILTER);
    setFunnelFilter(ALL_FILTER);
    setActiveId(null);
  }, [activeProjectId, setActiveId]);

  const hydrateFromHistory = useCallback((data: unknown) => {
    if (!isSuggestedKeywordsHistoryData(data)) {
      toast.error('Saved entry contains invalid data.');
      return;
    }

    setSeedKeyword(data.seedKeyword);
    setLocation(data.location ?? 'Malaysia');
    setResult({ seed: data.seed, suggestions: data.suggestions });
    setKeywordFilter('');
    setIntentFilter(ALL_FILTER);
    setFunnelFilter(ALL_FILTER);
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
          loadError instanceof Error ? loadError.message : 'Failed to load saved keywords.'
        );
      }
    },
    [hydrateFromHistory, loadEntry]
  );

  const handleGenerate = useCallback(async () => {
    const trimmedKeyword = seedKeyword.trim();
    if (!trimmedKeyword) {
      setError('Enter a seed keyword to generate suggestions.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setResult(null);
    setSavedEntryId(null);
    setActiveId(null);

    try {
      const response = await fetch('/api/suggested-keywords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedKeyword: trimmedKeyword,
          location: location === 'Global (USA)' ? undefined : location,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Keyword generation failed. Please try again.';
        throw new Error(message);
      }

      const generated = payload as SuggestedKeywordsResult;
      setResult(generated);
      setKeywordFilter('');
      setIntentFilter(ALL_FILTER);
      setFunnelFilter(ALL_FILTER);

      const saved = await save({
        id: savedEntryId ?? undefined,
        identifier: buildHistoryIdentifier(trimmedKeyword, location),
        workspaceId: activeProjectId,
        resultData: {
          seed: generated.seed,
          seedKeyword: trimmedKeyword,
          location: location === 'Global (USA)' ? undefined : location,
          suggestions: generated.suggestions,
          generatedAt: new Date().toISOString(),
          projectId: activeProjectId,
        },
      });

      setSavedEntryId(saved.id);
      toast.success('20 keyword suggestions generated and saved.');
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : 'Keyword generation failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [activeProjectId, location, save, savedEntryId, seedKeyword, setActiveId]);

  const intentOptions = useMemo(() => {
    if (!result) return [];
    return Array.from(new Set(result.suggestions.map(item => item.intent))).sort();
  }, [result]);

  const funnelOptions = useMemo(() => {
    if (!result) return [];
    return Array.from(new Set(result.suggestions.map(item => item.funnelStage))).sort();
  }, [result]);

  const filteredSuggestions = useMemo(() => {
    if (!result) return [];

    const query = keywordFilter.trim().toLowerCase();

    return result.suggestions
      .filter(item => {
        if (query && !item.keyword.toLowerCase().includes(query)) {
          return false;
        }
        if (intentFilter !== ALL_FILTER && item.intent !== intentFilter) {
          return false;
        }
        if (funnelFilter !== ALL_FILTER && item.funnelStage !== funnelFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        sortDirection === 'desc'
          ? b.relevanceScore - a.relevanceScore
          : a.relevanceScore - b.relevanceScore
      );
  }, [result, keywordFilter, intentFilter, funnelFilter, sortDirection]);

  function toggleSortDirection() {
    setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <ListPlus className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Suggested Keywords
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">Long-Tail Discovery</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            AI-powered long-tail keyword discovery with intent mapping, funnel staging, and
            content format recommendations. Results save automatically to your workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ToolHistoryPanel
          title="Saved Keywords"
          description="Reload past generations without re-running the AI."
          entries={entries}
          activeId={activeId}
          isLoading={isHistoryLoading}
          emptyMessage="Generate keywords to build your suggestion history."
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
              <CardTitle className="text-base">Seed Configuration</CardTitle>
              <CardDescription>
                Enter a seed keyword and optional target region to discover long-tail opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-5 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                onSubmit={event => {
                  event.preventDefault();
                  void handleGenerate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="seed-keyword">Seed Keyword</Label>
                  <Input
                    id="seed-keyword"
                    placeholder="e.g. solar panel installation"
                    value={seedKeyword}
                    onChange={event => setSeedKeyword(event.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <select
                    id="location"
                    value={location}
                    onChange={event => setLocation(event.target.value)}
                    disabled={isGenerating}
                    className="flex h-10 w-full min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ANALYSIS_LOCATION_OPTIONS.map(option => (
                      <option key={option.code} value={option.label}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={isGenerating}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Keywords
                    </>
                  )}
                </Button>
              </form>

              {error ? (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {isGenerating ? <TableSkeleton /> : null}

          {!isGenerating && result ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {result.suggestions.length} suggestions for{' '}
                    <span className="text-emerald-700 dark:text-emerald-300">&ldquo;{result.seed}&rdquo;</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredSuggestions.length} of {result.suggestions.length} after
                    filters
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="search"
                    placeholder="Filter by keyword…"
                    value={keywordFilter}
                    onChange={event => setKeywordFilter(event.target.value)}
                    className="h-9 w-full min-w-[180px] sm:w-48"
                  />

                  <select
                    value={intentFilter}
                    onChange={event => setIntentFilter(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                    aria-label="Filter by intent"
                  >
                    <option value={ALL_FILTER}>All intents</option>
                    {intentOptions.map(intent => (
                      <option key={intent} value={intent}>
                        {intent}
                      </option>
                    ))}
                  </select>

                  <select
                    value={funnelFilter}
                    onChange={event => setFunnelFilter(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                    aria-label="Filter by funnel stage"
                  >
                    <option value={ALL_FILTER}>All funnel stages</option>
                    {funnelOptions.map(stage => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/80 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Keyword</th>
                      <th className="px-3 py-2.5">Intent</th>
                      <th className="px-3 py-2.5">Funnel</th>
                      <th className="px-3 py-2.5">Format</th>
                      <th className="px-3 py-2.5">Difficulty</th>
                      <th className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={toggleSortDirection}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Relevance
                          <span className="text-[10px] text-muted-foreground">
                            {sortDirection === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th className="px-3 py-2.5">Angle</th>
                      <th className="px-3 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSuggestions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No keywords match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSuggestions.map(item => (
                        <tr key={item.keyword} className="hover:bg-muted/60">
                          <td className="max-w-[220px] px-3 py-2.5 font-medium leading-snug text-foreground">
                            {item.keyword}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold',
                                intentBadgeClass(item.intent)
                              )}
                            >
                              {item.intent}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold uppercase',
                                funnelStageBadgeClass(item.funnelStage)
                              )}
                            >
                              {item.funnelStage}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {item.suggestedFormat}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold',
                                difficultyBadgeClass(item.estimatedDifficulty)
                              )}
                            >
                              {item.estimatedDifficulty}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-foreground">
                            {item.relevanceScore}
                          </td>
                          <td className="max-w-[240px] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                            {item.angle}
                          </td>
                          <td className="px-3 py-2.5">
                            <BuildClusterButton keyword={item.keyword} geography={location} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {!isGenerating && !result ? (
            <Card className="border-dashed border-border bg-card/80 shadow-sm">
              <CardContent className="py-16 text-center">
                <Sparkles className="mx-auto mb-4 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-muted-foreground">No suggestions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter a seed keyword and generate long-tail variations, or load a saved run from
                  the history panel.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

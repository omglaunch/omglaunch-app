'use client';

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileText,
  Loader2,
  Network,
  PenLine,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { getSettingsBundle } from '@/app/actions/settings';
import { createKeywordAuditBrief } from '@/app/actions/content-pipeline';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { buildSiloBuilderHref } from '@/lib/silo-builder/deep-link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProject } from '@/components/projects/ProjectProvider';
import { useToolHistory } from '@/hooks/useToolHistory';
import { loadLatestKeywordAuditFromHistory } from '@/lib/keyword-audit/history-cache';
import {
  formatDeviceLabel,
  formatLanguageBadge,
  getCountryFlag,
  getCountryIsoCode,
  KEYWORD_AUDIT_COUNTRIES,
  KEYWORD_AUDIT_DEVICES,
  KEYWORD_AUDIT_LANGUAGES,
  type KeywordAuditGeoInput,
} from '@/lib/keyword-audit/geo';
import type { ToolHistorySummary } from '@/lib/tool-history/types';
import {
  buildHistoryIdentifier,
  formatSubtopicsBrief,
  getRecommendedTitle,
  isKeywordAuditHistoryData,
  type KeywordAuditResult,
} from '@/lib/types/keyword-audit';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

type GeoSettings = KeywordAuditGeoInput;

type KeywordAuditGenerateResponse = KeywordAuditResult & {
  dataForSeoFromCache?: boolean;
};

const DEFAULT_GEO: GeoSettings = {
  country: 'Malaysia',
  city: '',
  language: 'en',
  device: 'desktop',
};

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  icon: Icon,
  accentClass,
  className,
}: {
  label: string;
  value: string;
  icon: ElementType;
  accentClass: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            accentClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatSearchVolume(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value.toLocaleString();
}

function formatKeywordDifficulty(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}/100`;
}

function hasSeoMetrics(result: KeywordAuditResult): boolean {
  return (
    formatSearchVolume(result.searchVolume) !== null ||
    formatKeywordDifficulty(result.keywordDifficulty) !== null
  );
}

function renderHistoryBadges(entry: ToolHistorySummary): ReactNode {
  if (!entry.country && !entry.language && !entry.device) {
    return null;
  }

  const badges: ReactNode[] = [];

  if (entry.country) {
    badges.push(
      <Badge
        key="country"
        variant="outline"
        className="border-border bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
      >
        {getCountryFlag(entry.country)} {getCountryIsoCode(entry.country)}
      </Badge>
    );
  }

  if (entry.city) {
    badges.push(
      <Badge
        key="city"
        variant="outline"
        className="max-w-[120px] truncate border-border bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
      >
        {entry.city}
      </Badge>
    );
  }

  if (entry.language) {
    badges.push(
      <Badge
        key="language"
        variant="outline"
        className="border-border bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
      >
        {formatLanguageBadge(entry.language)}
      </Badge>
    );
  }

  if (entry.device) {
    badges.push(
      <Badge
        key="device"
        variant="outline"
        className="border-border bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
      >
        {formatDeviceLabel(entry.device)}
      </Badge>
    );
  }

  return badges;
}

function AuditResults({
  result,
  projectId,
  isFromCache,
  cachedAt,
  dataForSeoFromCache,
}: {
  result: KeywordAuditResult;
  projectId: string;
  isFromCache: boolean;
  cachedAt: number | null;
  dataForSeoFromCache: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isSendingToStudio, setIsSendingToStudio] = useState(false);

  const searchVolumeLabel = formatSearchVolume(result.searchVolume);
  const keywordDifficultyLabel = formatKeywordDifficulty(result.keywordDifficulty);
  const competitors = result.topCompetitors ?? [];
  const recommendedTitle = getRecommendedTitle(result);

  async function handleCopyBrief() {
    try {
      await navigator.clipboard.writeText(formatSubtopicsBrief(result));
      setCopied(true);
      toast.success('Content brief copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy brief.');
    }
  }

  async function handleSendToArticleStudio() {
    if (!projectId.trim()) {
      toast.error('Select a project before sending to Article Studio.');
      return;
    }

    setIsSendingToStudio(true);

    try {
      await createKeywordAuditBrief(
        result.keyword,
        recommendedTitle,
        formatSubtopicsBrief(result),
        projectId
      );

      const params = new URLSearchParams({
        targetKeyword: result.keyword,
        title: recommendedTitle,
      });

      router.push(`/article-studio?${params.toString()}`);
      toast.success('Brief sent to Article Studio.');
    } catch (sendError) {
      toast.error(
        sendError instanceof Error ? sendError.message : 'Failed to send brief to Article Studio.'
      );
    } finally {
      setIsSendingToStudio(false);
    }
  }

  return (
    <div className="space-y-6">
      {isFromCache || dataForSeoFromCache ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {isFromCache ? (
            <span>
              Loaded from saved audit
              {cachedAt ? ` · ${format(new Date(cachedAt), 'MMM d, yyyy · h:mm a')}` : ''}
            </span>
          ) : (
            <span>DataForSEO SERP data served from cache (30-day TTL)</span>
          )}
        </div>
      ) : null}

      {hasSeoMetrics(result) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {searchVolumeLabel ? (
            <SummaryMetricCard
              label="Search Volume"
              value={searchVolumeLabel}
              icon={TrendingUp}
              accentClass="border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            />
          ) : null}
          {keywordDifficultyLabel ? (
            <SummaryMetricCard
              label="Keyword Difficulty"
              value={keywordDifficultyLabel}
              icon={BarChart3}
              accentClass="border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-3">
          <SummaryMetricCard
            label="Recommended Format"
            value={result.recommendedFormat}
            icon={FileText}
            accentClass="border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          />
          <SummaryMetricCard
            label="Target Word Count"
            value={result.targetWordCount.toLocaleString()}
            icon={Target}
            accentClass="border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          />
          <SummaryMetricCard
            label="Primary Intent"
            value={result.userIntentCore}
            icon={Search}
            className="sm:col-span-1"
            accentClass="border-sky-100 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
          onClick={() => {
            router.push(
              buildSiloBuilderHref({
                seed: result.keyword,
                geography: result.country,
                mode: 'quick',
              })
            );
          }}
        >
          <Network className="h-4 w-4" />
          Map Content Hub
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Content Brief Outline
              </CardTitle>
              <CardDescription className="text-xs">
                Mandatory subtopics for topical authority on &ldquo;{result.keyword}&rdquo;
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-500"
                disabled={isSendingToStudio}
                onClick={() => void handleSendToArticleStudio()}
              >
                {isSendingToStudio ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PenLine className="h-3.5 w-3.5" />
                )}
                Send to Article Studio
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => void handleCopyBrief()}
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy Brief'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {result.requiredSubtopics.map((subtopic, index) => (
                <li
                  key={`${subtopic.heading}-${index}`}
                  className="relative rounded-lg border border-border bg-muted/60 p-4 pl-5"
                >
                  <span className="absolute left-0 top-4 h-full w-1 rounded-r bg-emerald-500 dark:bg-emerald-400" />
                  <div className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className="mt-0.5 shrink-0 border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      H{index % 3 === 0 ? '2' : '3'}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{subtopic.heading}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {subtopic.purpose}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {competitors.length > 0 ? (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  Top Competitors
                </CardTitle>
                <CardDescription className="text-xs">
                  Current top-ranking URLs for this keyword in your target market
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {competitors.map((competitor, index) => (
                    <li
                      key={`${competitor.url}-${index}`}
                      className="rounded-lg border border-border bg-muted/70 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={competitor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex max-w-full items-start gap-1 text-sm font-medium text-foreground hover:text-emerald-700 dark:hover:text-emerald-300"
                          >
                            <span className="line-clamp-2">{competitor.title}</span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                          </a>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {competitor.domain}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Core Pain Points
              </CardTitle>
              <CardDescription className="text-xs">
                Friction signals the content must resolve
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.corePainPoints.map((painPoint, index) => (
                  <li
                    key={`${painPoint}-${index}`}
                    className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/40"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700 dark:bg-rose-900/60 dark:text-rose-200">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground">{painPoint}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                SERP Features to Target
              </CardTitle>
              <CardDescription className="text-xs">
                Winnable search result placements for this keyword
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {result.serpFeaturesToTarget.map((feature, index) => (
                  <li
                    key={`${feature}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function KeywordAuditClient() {
  const searchParams = useSearchParams();
  const { activeProjectId } = useProject();

  const [keyword, setKeyword] = useState('');
  const [geo, setGeo] = useState<GeoSettings>(DEFAULT_GEO);
  const [result, setResult] = useState<KeywordAuditResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [isGeoLoading, setIsGeoLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [dataForSeoFromCache, setDataForSeoFromCache] = useState(false);

  const hasAutoRun = useRef(false);
  const isHydratingFromHistoryRef = useRef(false);
  const generateInFlightRef = useRef(false);

  const {
    entries,
    isLoading: isHistoryLoading,
    activeId,
    save,
    remove,
    loadEntry,
    setActiveId,
  } = useToolHistory('keyword-audit', {
    limit: 25,
    workspaceId: activeProjectId,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsGeoLoading(true);
      try {
        const settings = await getSettingsBundle();
        if (cancelled) {
          return;
        }

        setGeo({
          country: settings.workspace.defaultCountry || DEFAULT_GEO.country,
          city: settings.workspace.defaultState || '',
          language: settings.workspace.defaultLanguage || DEFAULT_GEO.language,
          device: settings.workspace.defaultDevice || DEFAULT_GEO.device,
        });
      } catch {
        if (!cancelled) {
          setGeo(DEFAULT_GEO);
        }
      } finally {
        if (!cancelled) {
          setIsGeoLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setResult(null);
    setSavedEntryId(null);
    setError(null);
    setActiveId(null);
    setIsFromCache(false);
    setCachedAt(null);
    setDataForSeoFromCache(false);
    hasAutoRun.current = false;
  }, [activeProjectId, setActiveId]);

  const hydrateFromHistory = useCallback((data: unknown) => {
    if (!isKeywordAuditHistoryData(data)) {
      toast.error('Saved entry contains invalid data.');
      return;
    }

    setKeyword(data.keyword);
    setGeo({
      country: data.country || DEFAULT_GEO.country,
      city: data.city || '',
      language: data.language || DEFAULT_GEO.language,
      device: data.device || DEFAULT_GEO.device,
    });
    setResult(data);
    setError(null);
    setIsFromCache(true);
    setCachedAt(Date.now());
    setDataForSeoFromCache(false);
  }, []);

  const handleLoadHistory = useCallback(
    async (id: string) => {
      isHydratingFromHistoryRef.current = true;
      hasAutoRun.current = true;

      try {
        const entry = await loadEntry(id);
        hydrateFromHistory(entry.resultData);
        setSavedEntryId(entry.id);
      } catch (loadError) {
        toast.error(
          loadError instanceof Error ? loadError.message : 'Failed to load saved audit.'
        );
      } finally {
        isHydratingFromHistoryRef.current = false;
      }
    },
    [hydrateFromHistory, loadEntry]
  );

  const handleGenerate = useCallback(
    async (keywordOverride?: string, options?: { forceRefresh?: boolean }) => {
      const trimmedKeyword = (keywordOverride ?? keyword).trim();
      const forceRefresh = options?.forceRefresh ?? false;

      if (!trimmedKeyword) {
        setError('Enter a keyword to run a deep audit.');
        return;
      }

      if (generateInFlightRef.current) {
        return;
      }

      if (!forceRefresh && activeProjectId.trim()) {
        try {
          const cached = await loadLatestKeywordAuditFromHistory({
            keyword: trimmedKeyword,
            geo,
            workspaceId: activeProjectId,
          });

          if (cached) {
            setKeyword(cached.result.keyword);
            setResult(cached.result);
            setSavedEntryId(cached.historyId);
            setActiveId(cached.historyId);
            setIsFromCache(true);
            setCachedAt(cached.cachedAt);
            setDataForSeoFromCache(false);
            setError(null);
            toast.success('Loaded cached keyword audit — no API credits used.');
            return;
          }
        } catch {
          // Fall through to fresh generation.
        }
      }

      setError(null);
      setIsGenerating(true);
      setResult(null);
      setSavedEntryId(null);
      setActiveId(null);
      setIsFromCache(false);
      setCachedAt(null);
      setDataForSeoFromCache(false);

      generateInFlightRef.current = true;

      try {
        const response = await fetch('/api/keyword-audit/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: trimmedKeyword,
            country: geo.country,
            city: geo.city || undefined,
            language: geo.language,
            device: geo.device,
            workspaceId: activeProjectId,
            forceRefresh,
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String(payload.error)
              : 'Keyword audit failed. Please try again.';
          throw new Error(message);
        }

        const generated = payload as KeywordAuditGenerateResponse;
        setKeyword(generated.keyword);
        setResult(generated);
        setDataForSeoFromCache(Boolean(generated.dataForSeoFromCache));

        const saved = await save({
          id: forceRefresh ? undefined : savedEntryId ?? undefined,
          identifier: buildHistoryIdentifier(trimmedKeyword),
          workspaceId: activeProjectId,
          resultData: {
            ...generated,
            projectId: activeProjectId,
          },
        });

        setSavedEntryId(saved.id);
        setCachedAt(Date.now());
        toast.success(
          generated.dataForSeoFromCache
            ? 'Keyword audit generated — DataForSEO metrics loaded from cache.'
            : 'Keyword audit generated and saved.'
        );
      } catch (generateError) {
        const message =
          generateError instanceof Error
            ? generateError.message
            : 'Keyword audit failed. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        generateInFlightRef.current = false;
        setIsGenerating(false);
      }
    },
    [activeProjectId, geo, keyword, save, savedEntryId, setActiveId]
  );

  useEffect(() => {
    if (
      hasAutoRun.current ||
      isHistoryLoading ||
      isHydratingFromHistoryRef.current ||
      isGeoLoading
    ) {
      return;
    }

    const urlKeyword =
      searchParams.get('keyword')?.trim() ?? searchParams.get('seed')?.trim() ?? '';

    if (!urlKeyword) {
      return;
    }

    hasAutoRun.current = true;
    setKeyword(urlKeyword);
    void handleGenerate(urlKeyword);
  }, [activeProjectId, handleGenerate, isGeoLoading, isHistoryLoading, searchParams]);

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <Search className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Keyword Audit
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">SERP Content Blueprint</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Reverse-engineer the SERP for any target keyword and receive a programmatic content
            blueprint with format, word count, subtopics, and SERP feature targets. Results save
            automatically to your workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ToolHistoryPanel
          title="Saved Audits"
          description="Reload past keyword audits without re-running the AI."
          entries={entries}
          activeId={activeId}
          isLoading={isHistoryLoading}
          emptyMessage="Run a deep audit to build your keyword strategy history."
          onLoad={entry => void handleLoadHistory(entry.id)}
          onDelete={id => {
            void remove(id);
            if (activeId === id) {
              setResult(null);
              setSavedEntryId(null);
            }
          }}
          renderMetadata={renderHistoryBadges}
        />

        <div className="min-w-0 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Target Keyword</CardTitle>
              <CardDescription>
                Enter the keyword you want to reverse-engineer for content strategy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={event => {
                  event.preventDefault();
                  void handleGenerate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="keyword-audit-input">Keyword</Label>
                  <Input
                    id="keyword-audit-input"
                    placeholder="e.g. enterprise seo audit checklist"
                    value={keyword}
                    onChange={event => setKeyword(event.target.value)}
                    disabled={isGenerating || isGeoLoading}
                  />
                </div>

                <Accordion type="single" collapsible className="rounded-lg border border-border px-3">
                  <AccordionItem value="geo-settings" className="border-none">
                    <AccordionTrigger className="py-3 text-sm font-medium text-foreground hover:no-underline">
                      Advanced Geo-Settings
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 pb-1 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="keyword-audit-country">Country</Label>
                          <Select
                            value={geo.country}
                            onValueChange={value =>
                              setGeo(current => ({ ...current, country: value }))
                            }
                            disabled={isGenerating || isGeoLoading}
                          >
                            <SelectTrigger id="keyword-audit-country">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {KEYWORD_AUDIT_COUNTRIES.map(country => (
                                <SelectItem key={country.code} value={country.label}>
                                  {country.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="keyword-audit-city">City / Region</Label>
                          <Input
                            id="keyword-audit-city"
                            placeholder="e.g., Kuala Lumpur (Optional)"
                            value={geo.city ?? ''}
                            onChange={event =>
                              setGeo(current => ({ ...current, city: event.target.value }))
                            }
                            disabled={isGenerating || isGeoLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="keyword-audit-language">Language</Label>
                          <Select
                            value={geo.language}
                            onValueChange={value =>
                              setGeo(current => ({ ...current, language: value }))
                            }
                            disabled={isGenerating || isGeoLoading}
                          >
                            <SelectTrigger id="keyword-audit-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              {KEYWORD_AUDIT_LANGUAGES.map(language => (
                                <SelectItem key={language.value} value={language.value}>
                                  {language.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="keyword-audit-device">Device</Label>
                          <Select
                            value={geo.device}
                            onValueChange={value =>
                              setGeo(current => ({ ...current, device: value }))
                            }
                            disabled={isGenerating || isGeoLoading}
                          >
                            <SelectTrigger id="keyword-audit-device">
                              <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                              {KEYWORD_AUDIT_DEVICES.map(device => (
                                <SelectItem key={device.value} value={device.value}>
                                  {device.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    disabled={isGenerating || isGeoLoading}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-500"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running Deep Audit…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Run Deep Audit
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isGenerating || isGeoLoading || !keyword.trim()}
                    className="gap-2"
                    onClick={() => void handleGenerate(undefined, { forceRefresh: true })}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Force Refresh
                  </Button>
                </div>

                {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              </form>
            </CardContent>
          </Card>

          {isGenerating ? <ResultsSkeleton /> : null}
          {!isGenerating && result ? (
            <AuditResults
              result={result}
              projectId={activeProjectId}
              isFromCache={isFromCache}
              cachedAt={cachedAt}
              dataForSeoFromCache={dataForSeoFromCache}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

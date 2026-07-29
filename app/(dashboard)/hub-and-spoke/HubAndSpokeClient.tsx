'use client';

import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  LayoutGrid,
  Loader2,
  Map,
  Network,
  PenLine,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/components/projects/ProjectProvider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { siloFunnelStageClass } from '@/components/silo-builder/silo-theme';
import SiloSummaryMetrics from '@/components/dashboard/SiloSummaryMetrics';
import { ANALYSIS_LOCATION_OPTIONS } from '@/lib/analysis-state';
import { storeHubSpokeBulkImport } from '@/lib/hub-spoke-bulk-import';
import type {
  HubSpokeCluster,
  HubSpokeMap,
  HubSpokeMapSummary,
} from '@/lib/hub-spoke-data';
import { deleteHubSpokeMap, listHubSpokeMaps } from '@/lib/topical-map/client';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

const hubKeywordClass = 'text-emerald-600 dark:text-emerald-400';

const TopicalMapVisualizer = dynamic(
  () => import('@/components/dashboard/TopicalMapVisualizer'),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[700px] w-full rounded-xl" />,
  }
);

function buildArticleStudioHref(cluster: HubSpokeCluster): string {
  const params = new URLSearchParams({
    targetKeyword: cluster.targetKeyword,
    title: cluster.title,
  });
  return `/article-studio?${params.toString()}`;
}

function clusterSelectionKey(cluster: HubSpokeCluster): string {
  return cluster.id ?? cluster.targetKeyword;
}

function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return value.toLocaleString();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Card className="border-zinc-200 bg-zinc-50/80 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <CardHeader>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-16 w-full rounded-lg mt-4" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <Card key={index} className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ClusterCard({
  cluster,
  selected,
  onToggleSelect,
}: {
  cluster: HubSpokeCluster;
  selected: boolean;
  onToggleSelect: (key: string) => void;
}) {
  const selectionKey = clusterSelectionKey(cluster);

  return (
    <Card className="flex h-full flex-col border-border bg-card shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug text-foreground">{cluster.title}</CardTitle>
            <CardDescription className={cn('text-xs font-medium', hubKeywordClass)}>
              {cluster.targetKeyword}
            </CardDescription>
          </div>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(selectionKey)}
            aria-label={`Select ${cluster.title}`}
            className="mt-0.5 shrink-0"
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{cluster.summary}</p>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={cn('text-[11px] font-semibold uppercase', siloFunnelStageClass(cluster.funnelStage))}
          >
            {cluster.funnelStage}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-[11px] text-muted-foreground">
            {cluster.searchIntent}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-[11px] text-muted-foreground">
            Vol {formatMetricValue(cluster.searchVolume)}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-[11px] text-muted-foreground">
            KD {formatMetricValue(cluster.keywordDifficulty)}
          </Badge>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Anchor to Pillar
          </p>
          <span className="inline-block rounded-md border border-emerald-500/20 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
            {cluster.anchorTextToPillar}
          </span>
        </div>

        {cluster.lateralLinks.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lateral Links
            </p>
            <div className="space-y-1.5">
              {cluster.lateralLinks.map(link => (
                <div
                  key={`${link.spokeTitle}-${link.suggestedLateralAnchorText}`}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-zinc-700 transition hover:border-emerald-500/40 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300"
                >
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    {link.spokeTitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                    {link.suggestedLateralAnchorText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Semantic Entities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cluster.semanticEntities.map(entity => (
              <span
                key={entity}
                className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200"
          >
            <Link href={buildArticleStudioHref(cluster)}>
              <PenLine className="h-3.5 w-3.5" />
              Draft in Article Studio
              <ArrowRight className="ml-auto h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MapVisualization({
  map,
  selectedClusterKeys,
  onToggleCluster,
}: {
  map: HubSpokeMap;
  selectedClusterKeys: Set<string>;
  onToggleCluster: (key: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        Pillar Page
        <span className="h-px flex-1 bg-border" />
      </div>

      <Card className="border-zinc-200 bg-zinc-50/80 shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="mb-3 border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">
                Core Pillar
              </Badge>
              <CardTitle className="text-2xl leading-tight text-foreground">
                {map.pillar.title}
              </CardTitle>
              <CardDescription className={cn('mt-2 text-sm font-medium', hubKeywordClass)}>
                Target keyword: {map.pillar.targetKeyword}
              </CardDescription>
            </div>
            <Target className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">{map.pillar.summary}</p>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Primary Call to Action
            </p>
            <p className="text-sm font-medium text-foreground">{map.pillar.primaryCallToAction}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {map.clusters.length} Cluster Pages
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {map.clusters.map(cluster => (
          <ClusterCard
            key={clusterSelectionKey(cluster)}
            cluster={cluster}
            selected={selectedClusterKeys.has(clusterSelectionKey(cluster))}
            onToggleSelect={onToggleCluster}
          />
        ))}
      </div>
    </div>
  );
}

function BulkActionBar({
  selectedCount,
  onSendToArticleStudio,
  isSending,
}: {
  selectedCount: number;
  onSendToArticleStudio: () => void;
  isSending: boolean;
}) {
  if (selectedCount < 1) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-card px-5 py-3 shadow-lg dark:border-emerald-500/40 dark:bg-zinc-950">
        <p className="text-sm font-medium text-foreground">
          {selectedCount} Article{selectedCount === 1 ? '' : 's'} Selected
        </p>
        <Button
          type="button"
          onClick={onSendToArticleStudio}
          disabled={isSending}
          className="gap-2 bg-emerald-600 hover:bg-emerald-500"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" />
              Send to Article Studio
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function HubAndSpokeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = useProject().activeProjectId;
  const seedFromUrl = searchParams.get('seed')?.trim() ?? '';

  const [seedKeyword, setSeedKeyword] = useState('');
  const [location, setLocation] = useState('Malaysia');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isSendingToStudio, setIsSendingToStudio] = useState(false);
  const [savedMaps, setSavedMaps] = useState<HubSpokeMapSummary[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [activeMap, setActiveMap] = useState<HubSpokeMap | null>(null);
  const [selectedClusterKeys, setSelectedClusterKeys] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [error, setError] = useState<string | null>(null);

  const selectedClusters = useMemo(() => {
    if (!activeMap) {
      return [];
    }

    return activeMap.clusters.filter(cluster =>
      selectedClusterKeys.has(clusterSelectionKey(cluster))
    );
  }, [activeMap, selectedClusterKeys]);

  function handleToggleCluster(key: string) {
    setSelectedClusterKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSendToArticleStudio() {
    if (!selectedClusters.length) {
      return;
    }

    setIsSendingToStudio(true);

    try {
      storeHubSpokeBulkImport(
        selectedClusters.map(cluster => ({
          targetKeyword: cluster.targetKeyword,
          title: cluster.title,
        }))
      );
      router.push('/article-studio?bulkImport=hub-spoke');
    } catch (sendError) {
      toast.error(
        sendError instanceof Error
          ? sendError.message
          : 'Failed to send selected articles to Article Studio.'
      );
      setIsSendingToStudio(false);
    }
  }

  const fetchSavedMaps = useCallback(async () => {
    const response = await fetch(
      `/api/hub-spoke/list?workspaceId=${encodeURIComponent(projectId)}`
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String(payload.error)
          : 'Failed to load saved strategies.';
      throw new Error(message);
    }

    const maps =
      typeof payload === 'object' && payload !== null && 'maps' in payload
        ? (payload.maps as HubSpokeMapSummary[])
        : [];

    setSavedMaps(maps);
    return maps;
  }, [projectId]);

  const loadMapById = useCallback(async (id: string) => {
    setIsLoadingMap(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/hub-spoke/${id}?workspaceId=${encodeURIComponent(projectId)}`
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to load strategy.';
        throw new Error(message);
      }

      const record =
        typeof payload === 'object' && payload !== null && 'map' in payload
          ? (payload.map as {
              id: string;
              seedKeyword: string;
              location: string;
              mapData: HubSpokeMap;
            })
          : null;

      if (!record) {
        throw new Error('Strategy returned invalid data.');
      }

      setActiveMapId(record.id);
      setActiveMap(record.mapData);
      setSeedKeyword(record.seedKeyword);
      setLocation(record.location);
      setSelectedClusterKeys(new Set());
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Failed to load strategy.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoadingMap(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (seedFromUrl) {
      setSeedKeyword(seedFromUrl);
    }
  }, [seedFromUrl]);

  useEffect(() => {
    setActiveMapId(null);
    setActiveMap(null);
    setError(null);
    setIsLoadingList(true);
    void (async () => {
      try {
        await fetchSavedMaps();
      } catch (listError) {
        toast.error(
          listError instanceof Error ? listError.message : 'Failed to load saved strategies.'
        );
      } finally {
        setIsLoadingList(false);
      }
    })();
  }, [projectId, fetchSavedMaps]);

  async function handleGenerate() {
    const trimmedKeyword = seedKeyword.trim();
    if (!trimmedKeyword) {
      setError('Enter a seed keyword to generate your topical map.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setActiveMap(null);
    setActiveMapId(null);
    setSelectedClusterKeys(new Set());

    try {
      const generateResponse = await fetch('/api/generate-hub-spoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedKeyword: trimmedKeyword,
          location,
          workspaceId: projectId,
          projectId,
        }),
      });

      const generatePayload = await generateResponse.json().catch(() => ({}));

      if (generateResponse.status === 402) {
        const insufficientCreditsMessage =
          typeof generatePayload === 'object' &&
          generatePayload !== null &&
          'error' in generatePayload
            ? String(generatePayload.error)
            : 'Insufficient credits to generate map.';
        toast.error(insufficientCreditsMessage);
        setError(insufficientCreditsMessage);
        return;
      }

      if (!generateResponse.ok) {
        const message =
          typeof generatePayload === 'object' &&
          generatePayload !== null &&
          'error' in generatePayload
            ? String(generatePayload.error)
            : 'Map generation failed. Please try again.';
        throw new Error(message);
      }

      const generatedMap =
        typeof generatePayload === 'object' &&
        generatePayload !== null &&
        'map' in generatePayload
          ? (generatePayload.map as HubSpokeMap)
          : null;

      if (!generatedMap) {
        throw new Error('Map generation returned invalid data.');
      }

      const saveResponse = await fetch('/api/hub-spoke/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedKeyword: trimmedKeyword,
          location,
          mapData: generatedMap,
          workspaceId: projectId,
          projectId,
        }),
      });

      const savePayload = await saveResponse.json().catch(() => ({}));

      if (!saveResponse.ok) {
        const message =
          typeof savePayload === 'object' && savePayload !== null && 'error' in savePayload
            ? String(savePayload.error)
            : 'Map generated but failed to save.';
        throw new Error(message);
      }

      const savedRecord =
        typeof savePayload === 'object' && savePayload !== null && 'map' in savePayload
          ? (savePayload.map as {
              id: string;
              seedKeyword: string;
              location: string;
              mapData: HubSpokeMap;
            })
          : null;

      if (!savedRecord) {
        throw new Error('Save returned invalid data.');
      }

      await fetchSavedMaps();
      setActiveMapId(savedRecord.id);
      setActiveMap(savedRecord.mapData);
      setSelectedClusterKeys(new Set());
      toast.success('Topical map generated and saved.');
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : 'Map generation failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
      window.dispatchEvent(new Event('credits-updated'));
    }
  }

  async function handleDelete(id: string, event: React.MouseEvent) {
    event.stopPropagation();

    setIsDeletingId(id);

    try {
      const response = await fetch(
        `/api/hub-spoke/delete/${id}?workspaceId=${encodeURIComponent(projectId)}`,
        {
          method: 'DELETE',
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to delete strategy.';
        throw new Error(message);
      }

      const remaining = savedMaps.filter(map => map.id !== id);
      setSavedMaps(remaining);

      if (activeMapId === id) {
        setActiveMapId(null);
        setActiveMap(null);
        setSelectedClusterKeys(new Set());
      }

      toast.success('Strategy deleted.');
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete strategy.'
      );
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-6 overflow-x-hidden lg:flex-row">
      {/* Saved Strategies sidebar */}
      <aside className="flex w-full min-w-0 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm lg:w-1/4 lg:max-w-xs">
        <div className="border-b border-border px-4 py-4">
          <h2 className="text-sm font-semibold text-foreground">Saved Strategies</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{savedMaps.length} maps stored</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoadingList ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : savedMaps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/60 px-3 py-8 text-center">
              <Map className="mx-auto mb-2 h-7 w-7 text-gray-300" />
              <p className="text-xs font-medium text-muted-foreground">No saved strategies yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Generate a map to save your first topical architecture.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {savedMaps.map(item => {
                const isActive = item.id === activeMapId;

                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        'group flex items-start gap-1 rounded-lg border transition-all',
                        isActive
                          ? 'border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-950/20'
                          : 'border border-transparent hover:border-border hover:bg-muted'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void loadMapById(item.id)}
                        disabled={isLoadingMap && activeMapId === item.id}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left"
                      >
                        <p
                          className={cn(
                            'truncate text-sm font-medium',
                            isActive
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-foreground'
                          )}
                        >
                          {item.seedKeyword}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {item.location} · {format(new Date(item.createdAt), 'MMM d, yyyy')}
                        </p>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mr-1 mt-1.5 h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        disabled={isDeletingId === item.id}
                        onClick={event => void handleDelete(item.id, event)}
                        aria-label={`Delete ${item.seedKeyword}`}
                      >
                        {isDeletingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
        <div className="w-full min-w-0 max-w-full space-y-8">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <Map className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">
                Topical Authority Studio
              </h1>
              <p className="mt-1 max-w-full text-sm text-muted-foreground">
                Generate a GEO-optimized topical map with one pillar page and 8–10 supporting
                cluster pages. Maps are saved automatically with DataForSEO metrics and
                spoke-to-spoke lateral links.
              </p>
            </div>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Seed Configuration</CardTitle>
              <CardDescription>
                Enter a broad seed keyword and target region to architect your content silo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
                onSubmit={event => {
                  event.preventDefault();
                  void handleGenerate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="tour-keyword-input">Seed Keyword</Label>
                  <Input
                    id="tour-keyword-input"
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
                    className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                      Generate Map
                    </>
                  )}
                </Button>
              </form>

              {error && (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          {isGenerating && <LoadingSkeleton />}

          {!isGenerating && isLoadingMap && !activeMap && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading strategy…
            </div>
          )}

          {activeMap && !isGenerating && (
            <>
              <SiloSummaryMetrics map={activeMap} />

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (activeMapId) {
                      router.push(`/dashboard/silo-builder?import=${activeMapId}`);
                    }
                  }}
                  disabled={!activeMapId}
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
                  <ToggleGroupItem value="grid" aria-label="Grid view" className="gap-1.5 px-3">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid View
                  </ToggleGroupItem>
                  <ToggleGroupItem value="map" aria-label="Map view" className="gap-1.5 px-3">
                    <Network className="h-3.5 w-3.5" />
                    Map View
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {viewMode === 'grid' ? (
                <>
                  <MapVisualization
                    map={activeMap}
                    selectedClusterKeys={selectedClusterKeys}
                    onToggleCluster={handleToggleCluster}
                  />
                  <BulkActionBar
                    selectedCount={selectedClusters.length}
                    onSendToArticleStudio={handleSendToArticleStudio}
                    isSending={isSendingToStudio}
                  />
                </>
              ) : (
                <TopicalMapVisualizer map={activeMap} />
              )}
            </>
          )}

          {!isGenerating && !isLoadingMap && !activeMap && (
            <Card className="border-dashed border-border bg-card/80 shadow-sm">
              <CardContent className="py-16 text-center">
                <Sparkles className="mx-auto mb-4 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-muted-foreground">No map selected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate a new topical map or select a saved strategy from the sidebar.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

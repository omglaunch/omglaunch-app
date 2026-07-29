'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, LayoutGrid, Loader2, Map, Network, ArrowLeft, PenLine, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useProject } from '@/components/projects/ProjectProvider';
import SiloGridView from '@/components/silo-builder/SiloGridView';
import SiloMapView, { buildSiloMapExportFilename } from '@/components/silo-builder/SiloMapView';
import NodeInspector from '@/components/silo-builder/NodeInspector';
import SiloProjectMetrics from '@/components/silo-builder/SiloProjectMetrics';
import SemanticGapsPanel from '@/components/silo-builder/SemanticGapsPanel';
import CompetitorKeywordsTable from '@/components/silo-builder/CompetitorKeywordsTable';
import HubGroupsPanel from '@/components/silo-builder/HubGroupsPanel';
import SiloExportMenu from '@/components/silo-builder/SiloExportMenu';
import { SILO_CONTENT_GENERATION_CREDIT_COST } from '@/lib/silo-builder/constants';
import { formatLabsCostEstimateUsd } from '@/lib/silo-builder/labs-cost';
import {
  computeSiloMetricsStatusSummary,
  countNodesNeedingMetrics,
} from '@/lib/silo-builder/metrics';
import { getMetricsFreshness } from '@/lib/silo-builder/metrics-freshness';
import type { SiloNodeDto, SiloProjectDto } from '@/lib/silo-builder/types';
import { storeSiloBuilderBulkImport } from '@/lib/silo-builder/bulk-brief-import';
import { toast } from '@/components/ui/sonner';

type WorkspaceProps = {
  project: SiloProjectDto;
  onProjectUpdate: (project: SiloProjectDto) => void;
  onBack: () => void;
};

const POLL_INTERVAL_MS = 4000;

export default function Workspace({ project, onProjectUpdate, onBack }: WorkspaceProps) {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [nodes, setNodes] = useState<SiloNodeDto[]>(project.nodes);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectorNode, setInspectorNode] = useState<SiloNodeDto | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingBriefs, setSendingBriefs] = useState(false);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [contentFactoryConfirmOpen, setContentFactoryConfirmOpen] = useState(false);
  const [refreshAllConfirmOpen, setRefreshAllConfirmOpen] = useState(false);

  const hasActiveJobs = nodes.some(
    n => n.status === 'QUEUED' || n.status === 'GENERATING'
  );
  const isMetricsEnriching = project.metricsStatus === 'enriching';

  const hasPendingStatusSync = nodes.some(
    n =>
      (n.articleStudioHistoryId || n.wpPostId) &&
      n.status !== 'PUBLISHED' &&
      n.status !== 'FAILED' &&
      n.status !== 'QUEUED' &&
      n.status !== 'GENERATING'
  );

  const refreshProject = useCallback(async (): Promise<SiloProjectDto | null> => {
    try {
      const res = await fetch(`/api/silo-builder/projects/${project.id}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { project: SiloProjectDto };
      setNodes(data.project.nodes);
      onProjectUpdate(data.project);
      return data.project;
    } catch {
      return null;
    }
  }, [project.id, onProjectUpdate]);

  useEffect(() => {
    setNodes(project.nodes);
  }, [project.nodes]);

  useEffect(() => {
    if (!hasPendingStatusSync) return;

    void (async () => {
      try {
        await fetch(`/api/silo-builder/projects/${project.id}/sync-status`, {
          method: 'POST',
        });
        await refreshProject();
      } catch {
        // Best-effort initial sync.
      }
    })();
  }, [project.id, hasPendingStatusSync, refreshProject]);

  useEffect(() => {
    if (!hasActiveJobs && !hasPendingStatusSync && !isMetricsEnriching) return;

    const interval = setInterval(async () => {
      if (hasPendingStatusSync && !hasActiveJobs) {
        try {
          await fetch(`/api/silo-builder/projects/${project.id}/sync-status`, {
            method: 'POST',
          });
        } catch {
          // Best-effort background sync.
        }
      }
      await refreshProject();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    hasActiveJobs,
    hasPendingStatusSync,
    isMetricsEnriching,
    project.id,
    refreshProject,
  ]);

  function handleNodeClick(node: SiloNodeDto) {
    setInspectorNode(node);
    setInspectorOpen(true);
  }

  function handleSelectionToggle(nodeId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function handleNodeUpdated(updated: SiloNodeDto) {
    setNodes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
    setInspectorNode(updated);
    onProjectUpdate({
      ...project,
      nodes: project.nodes.map(n => (n.id === updated.id ? updated : n)),
    });
  }

  function handleSpokeCreated(node: SiloNodeDto) {
    const nextNodes = [...nodes, node];
    const summary = computeSiloMetricsStatusSummary(
      nextNodes,
      project.metricsEnrichedAt
    );
    setNodes(nextNodes);
    onProjectUpdate({
      ...project,
      nodes: nextNodes,
      metricsStatus: summary.status,
      metricsEnrichedAt: summary.enrichedAt ?? project.metricsEnrichedAt,
      metricsCompleteCount: summary.completeCount,
      metricsTotalCount: summary.totalCount,
    });
  }

  function handleHubGroupSpokeClick(title: string) {
    const normalizedTitle = title.trim().toLowerCase();
    const spoke = nodes.find(
      node =>
        node.type === 'SPOKE' &&
        node.title.trim().toLowerCase() === normalizedTitle
    );

    if (!spoke) {
      toast.error(`Spoke "${title}" was not found in this silo.`);
      return;
    }

    setViewMode('grid');
    setHighlightedNodeId(spoke.id);
    handleNodeClick(spoke);

    window.setTimeout(() => {
      document
        .querySelector(`[data-silo-node-id="${spoke.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    window.setTimeout(() => {
      setHighlightedNodeId(current => (current === spoke.id ? null : current));
    }, 2400);
  }

  async function handleSendToContentFactory() {
    if (selectedIds.size === 0) {
      toast.error('Select at least one node to send to the Content Factory.');
      return;
    }

    if (!activeProjectId.trim()) {
      toast.error('Select a project before sending to the Content Factory.');
      return;
    }

    setContentFactoryConfirmOpen(false);
    setGenerating(true);
    try {
      const res = await fetch('/api/silo-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          nodeIds: Array.from(selectedIds),
          articleStudioProjectId: activeProjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Queue failed');

      window.dispatchEvent(new Event('credits-updated'));

      if (data.completed) {
        toast.success(
          `Generated ${data.queued} article(s). Copies are available in Article Studio for editing.`
        );
      } else {
        toast.success(
          `Queued ${data.queued} node(s) for content generation. Copies will sync to Article Studio when ready.`
        );
      }

      setSelectedIds(new Set());
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Queue failed');
    } finally {
      setGenerating(false);
    }
  }

  function requestContentFactoryConfirm() {
    if (selectedIds.size === 0) {
      toast.error('Select at least one node to send to the Content Factory.');
      return;
    }

    if (!activeProjectId.trim()) {
      toast.error('Select a project before sending to the Content Factory.');
      return;
    }

    setContentFactoryConfirmOpen(true);
  }

  function handleSendBriefsToArticleStudio() {
    if (selectedIds.size === 0) {
      toast.error('Select at least one node to send briefs to Article Studio.');
      return;
    }

    if (!activeProjectId.trim()) {
      toast.error('Select a project before sending briefs to Article Studio.');
      return;
    }

    const selectedNodes = nodes.filter(node => selectedIds.has(node.id));
    if (!selectedNodes.length) {
      toast.error('Select at least one node to send briefs to Article Studio.');
      return;
    }

    setSendingBriefs(true);

    try {
      storeSiloBuilderBulkImport(
        selectedNodes.map(node => ({
          siloNodeId: node.id,
          siloProjectId: project.id,
          siloProjectTitle: project.title,
          targetKeyword: (node.targetKeyword || node.title).trim(),
          title: node.title.trim(),
          intent: node.intent,
        }))
      );
      router.push('/article-studio?bulkImport=silo-builder');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to send selected briefs to Article Studio.'
      );
      setSendingBriefs(false);
    }
  }

  async function handleRetryGeneration(nodeId: string) {
    setGenerating(true);
    try {
      const res = await fetch('/api/silo-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          nodeIds: [nodeId],
          articleStudioProjectId: activeProjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');

      window.dispatchEvent(new Event('credits-updated'));
      const refreshed = await refreshProject();
      const updatedNode = refreshed?.nodes.find(node => node.id === nodeId);
      if (updatedNode) {
        setInspectorNode(updatedNode);
      }

      toast.success(
        data.completed
          ? 'Article generated and synced to Article Studio for editing.'
          : 'Generation restarted.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Retry failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefreshMetrics(mode: 'missing' | 'all') {
    setRefreshingMetrics(true);
    setRefreshAllConfirmOpen(false);
    try {
      const res = await fetch(
        `/api/silo-builder/projects/${project.id}/refresh-metrics`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Metrics refresh failed');

      setNodes(data.project.nodes);
      onProjectUpdate(data.project);
      toast.success(
        mode === 'missing'
          ? 'Missing keyword metrics enriched (batched + cached Labs).'
          : 'All keyword metrics refreshed (batched Labs, cache bypassed).'
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Metrics refresh failed'
      );
    } finally {
      setRefreshingMetrics(false);
    }
  }

  const selectedCount = selectedIds.size;
  const nodesNeedingMetrics = countNodesNeedingMetrics(nodes);
  const metricsSummary = computeSiloMetricsStatusSummary(
    nodes,
    project.metricsEnrichedAt,
    project.metricsStatus === 'enriching' ? 'enriching' : null
  );
  const metricsFreshness = getMetricsFreshness(metricsSummary.enrichedAt);
  const keywordNodeCount = nodes.filter(node =>
    Boolean(node.targetKeyword?.trim())
  ).length;
  const contentFactoryCreditCost = selectedCount * SILO_CONTENT_GENERATION_CREDIT_COST;
  const exportProject: SiloProjectDto = {
    ...project,
    nodes,
    metricsStatus: metricsSummary.status,
    metricsEnrichedAt: metricsSummary.enrichedAt,
    metricsCompleteCount: metricsSummary.completeCount,
    metricsTotalCount: metricsSummary.totalCount,
  };

  const contentFactoryButton = (
    <Button
      onClick={requestContentFactoryConfirm}
      disabled={generating || selectedCount === 0}
      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-indigo-600 dark:hover:bg-indigo-700"
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Factory className="h-4 w-4" />
      )}
      {selectedCount > 0
        ? `Send to Content Factory (${selectedCount} · ${contentFactoryCreditCost} credits)`
        : 'Send to Content Factory'}
    </Button>
  );

  const briefExportButton = (
    <Button
      type="button"
      variant="outline"
      onClick={handleSendBriefsToArticleStudio}
      disabled={sendingBriefs || selectedCount === 0}
      className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
    >
      {sendingBriefs ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <PenLine className="h-4 w-4" />
      )}
      {selectedCount > 0
        ? `Send briefs to Article Studio (${selectedCount} · 0 credits)`
        : 'Send briefs to Article Studio'}
    </Button>
  );

  return (
    <div className="relative w-full min-w-0 space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="shrink-0 gap-1.5 border-border bg-background text-foreground shadow-sm hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm dark:bg-indigo-600">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{project.title}</h2>
            <p className="text-xs text-muted-foreground">
              {project.type === 'KEYWORD' ? 'Hub & Spoke silo' : 'Competitor attack map'} ·{' '}
              {nodes.length} nodes
              {project.geography ? ` · ${project.geography}` : ''}
              {project.type === 'COMPETITOR' && project.keywordsAnalyzed != null
                ? ` · ${project.keywordsAnalyzed.toLocaleString()} keywords analyzed`
                : ''}
              {project.type === 'COMPETITOR' && project.semanticGaps.length > 0
                ? ` · ${project.semanticGaps.length} gaps`
                : ''}
              {hasActiveJobs && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing in background…
                </span>
              )}
              {isMetricsEnriching && !hasActiveJobs && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Enriching metrics {metricsSummary.completeCount}/
                  {metricsSummary.totalCount}…
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={v => v && setViewMode(v as 'grid' | 'map')}
            variant="outline"
            size="sm"
            className="rounded-lg border border-border bg-background p-1 shadow-sm"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" className="gap-1.5 px-3">
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid View
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view" className="gap-1.5 px-3">
              <Map className="h-3.5 w-3.5" />
              Map View
            </ToggleGroupItem>
          </ToggleGroup>

          <SiloExportMenu project={exportProject} />
          {nodesNeedingMetrics > 0 ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void handleRefreshMetrics('missing')}
              disabled={refreshingMetrics || isMetricsEnriching}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              {refreshingMetrics || isMetricsEnriching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Enrich missing ({nodesNeedingMetrics}
              {nodesNeedingMetrics > 0
                ? ` · ${formatLabsCostEstimateUsd(nodesNeedingMetrics)}`
                : ''}
              )
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshAllConfirmOpen(true)}
            disabled={refreshingMetrics || isMetricsEnriching}
            className="gap-1.5"
          >
            {refreshingMetrics || isMetricsEnriching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh all metrics
          </Button>
          {briefExportButton}
          {contentFactoryButton}
        </div>
      </div>

      {isMetricsEnriching ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
          <p className="font-medium inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enriching metrics {metricsSummary.completeCount}/{metricsSummary.totalCount}
          </p>
          <p className="mt-1 text-emerald-800/90 dark:text-indigo-200/80">
            Map structure is ready. Volume and KD fill in progressively from DataForSEO Labs
            (batched + cached).
          </p>
        </div>
      ) : nodesNeedingMetrics > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">
            Metrics {metricsSummary.status} · {metricsSummary.completeCount}/
            {metricsSummary.totalCount} nodes enriched
            {metricsFreshness.label ? ` · ${metricsFreshness.label}` : ''}
          </p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
            Opening a project no longer auto-fetches DataForSEO Labs. Use{' '}
            <span className="font-medium">Enrich missing</span> to fill gaps in one
            batched (cached) request, or Refresh all only when you need a full re-pull.
          </p>
        </div>
      ) : metricsFreshness.label ? (
        <p className="text-xs text-muted-foreground">
          Metrics complete · {metricsSummary.completeCount}/{metricsSummary.totalCount}{' '}
          nodes · {metricsFreshness.label}
        </p>
      ) : null}

      <SiloProjectMetrics
        nodes={nodes}
        metricsEnrichedAt={metricsSummary.enrichedAt}
      />

      {project.type === 'COMPETITOR' ? (
        <HubGroupsPanel
          hubGroups={project.hubGroups}
          onSpokeTitleClick={handleHubGroupSpokeClick}
        />
      ) : null}

      {project.type === 'COMPETITOR' ? (
        <SemanticGapsPanel
          gaps={project.semanticGaps}
          projectId={project.id}
          existingSpokes={nodes.filter(node => node.type === 'SPOKE')}
          onSpokeCreated={handleSpokeCreated}
        />
      ) : null}

      {project.type === 'COMPETITOR' ? (
        <CompetitorKeywordsTable
          keywords={project.rankedKeywords}
          keywordsAnalyzed={project.keywordsAnalyzed}
          importedFromTopicalMap={Boolean(project.importedFromTopicalMapId)}
        />
      ) : null}

      <p className="text-sm text-muted-foreground">
        Click a node to inspect details and view generated articles. Select pillar or spoke nodes
        with checkboxes (or ⌘/Ctrl+click on the map), then send briefs to Article Studio (
        <span className="font-medium text-foreground">0 credits</span>) or use the Content Factory
        to generate full articles (
        <span className="font-medium text-foreground">
          {SILO_CONTENT_GENERATION_CREDIT_COST} credits each
        </span>
        ).
      </p>

      {viewMode === 'grid' ? (
        <SiloGridView
          nodes={nodes}
          selectedIds={selectedIds}
          highlightedNodeId={highlightedNodeId}
          onNodeClick={handleNodeClick}
          onSelectionToggle={handleSelectionToggle}
        />
      ) : (
        <SiloMapView
          nodes={nodes}
          selectedIds={selectedIds}
          exportFilename={buildSiloMapExportFilename(project.title)}
          onNodeClick={handleNodeClick}
          onSelectionToggle={handleSelectionToggle}
        />
      )}

      {selectedCount > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90 dark:border-indigo-900/50">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span> node
            {selectedCount === 1 ? '' : 's'} selected
            <span className="mx-1.5 text-border">·</span>
            Content Factory up to{' '}
            <span className="font-semibold text-foreground">{contentFactoryCreditCost}</span>{' '}
            credits · briefs{' '}
            <span className="font-semibold text-foreground">0</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground"
            >
              Clear selection
            </Button>
            {briefExportButton}
            {contentFactoryButton}
          </div>
        </div>
      )}

      <AlertDialog open={contentFactoryConfirmOpen} onOpenChange={setContentFactoryConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate with Content Factory?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Generate{' '}
                  <span className="font-medium text-foreground">{selectedCount}</span> article
                  {selectedCount === 1 ? '' : 's'} for up to{' '}
                  <span className="font-medium text-foreground">
                    {contentFactoryCreditCost} credits
                  </span>{' '}
                  ({SILO_CONTENT_GENERATION_CREDIT_COST} each). Map generation is already paid
                  separately.
                </p>
                <p>
                  Prefer outlines only? Use{' '}
                  <span className="font-medium text-foreground">
                    Send briefs to Article Studio
                  </span>{' '}
                  instead — <span className="font-medium text-foreground">0 credits</span>.
                </p>
                <p className="text-xs">
                  Workspace Gemini keys may waive the Content Factory charge when BYOK is enabled.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={generating}
              className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              onClick={event => {
                event.preventDefault();
                void handleSendToContentFactory();
              }}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Queuing…
                </>
              ) : (
                `Generate · ${contentFactoryCreditCost} credits`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refreshAllConfirmOpen} onOpenChange={setRefreshAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh all keyword metrics?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-fetches volume and difficulty for {keywordNodeCount} keyword
              {keywordNodeCount === 1 ? '' : 's'} via batched DataForSEO Labs
              (bypasses cache). Estimated Labs cost:{' '}
              {formatLabsCostEstimateUsd(keywordNodeCount)}. Prefer Enrich missing
              when only some nodes are incomplete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refreshingMetrics}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={refreshingMetrics || isMetricsEnriching}
              onClick={event => {
                event.preventDefault();
                void handleRefreshMetrics('all');
              }}
            >
              {refreshingMetrics ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing…
                </>
              ) : (
                `Refresh all · ${formatLabsCostEstimateUsd(keywordNodeCount)}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NodeInspector
        node={inspectorNode}
        projectId={project.id}
        projectTitle={project.title}
        geography={project.geography}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        onNodeUpdated={handleNodeUpdated}
        onRetryGeneration={handleRetryGeneration}
      />
    </div>
  );
}

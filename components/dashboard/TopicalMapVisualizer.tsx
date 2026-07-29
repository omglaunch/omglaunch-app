'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowRight, Download, Loader2, MousePointerClick, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { siloFunnelStageClass } from '@/components/silo-builder/silo-theme';
import type { HubSpokeCluster, HubSpokeMap, HubSpokePillar } from '@/lib/hub-spoke-data';
import {
  captureTopicalMapPng,
  computeExportCanvasSize,
  downloadPngBlob,
  ensureTopicalMapExportStyles,
  waitForMapLayout,
} from '@/lib/topical-map/export-styles';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

const hubKeywordClass = 'text-emerald-600 dark:text-emerald-400';

const PILLAR_NODE_ID = 'pillar';
const CANVAS_CENTER_X = 600;
const CANVAS_CENTER_Y = 400;
const SPOKE_RADIUS = 460;
const BRAND_BLUE = '#2563eb';
const LATERAL_SLATE = '#94a3b8';

type PillarNodeData = {
  kind: 'pillar';
  pillar: HubSpokePillar;
};

type SpokeNodeData = {
  kind: 'spoke';
  cluster: HubSpokeCluster;
};

type MapNodeData = PillarNodeData | SpokeNodeData;

type SelectedNode =
  | { kind: 'pillar'; pillar: HubSpokePillar }
  | { kind: 'spoke'; cluster: HubSpokeCluster };

/** Light-only classes for map nodes — kept readable in PNG exports. */
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
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return value.toLocaleString();
}

function truncateLabel(text: string, maxLength = 22): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function spokeNodeId(cluster: HubSpokeCluster, index: number): string {
  return cluster.id ?? `spoke-${index}-${cluster.targetKeyword}`;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function buildArticleStudioHref(cluster: HubSpokeCluster): string {
  const params = new URLSearchParams({
    targetKeyword: cluster.targetKeyword,
    title: cluster.title,
  });
  return `/article-studio?${params.toString()}`;
}

function buildExportFilename(keyword: string): string {
  const slug = keyword
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `topical-map-${slug || 'export'}.png`;
}

const PillarMapNode = memo(function PillarMapNode({ data }: NodeProps<PillarNodeData>) {
  return (
    <div className="map-node-card map-node-card--pillar group w-[220px] cursor-pointer overflow-visible rounded-xl border-2 border-[#2563eb] bg-gradient-to-br from-blue-50 via-white to-white px-3 py-2.5 shadow-md transition-shadow hover:shadow-lg">
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="target" position={Position.Right} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="target" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Badge className="bg-[#2563eb] text-[9px] hover:bg-[#2563eb]">Core Pillar</Badge>
      <p className="map-node-title mt-1.5 line-clamp-3 text-[11px] font-semibold leading-relaxed text-gray-900">
        {data.pillar.title}
      </p>
      <p className="map-node-hint mt-1 text-[9px] font-medium text-blue-600 opacity-80 group-hover:opacity-100">
        Click for details →
      </p>
    </div>
  );
});

const SpokeMapNode = memo(function SpokeMapNode({ data }: NodeProps<SpokeNodeData>) {
  const { cluster } = data;

  return (
    <div className="map-node-card map-node-card--spoke group w-[170px] cursor-pointer overflow-visible rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition-shadow hover:border-blue-200 hover:shadow-md">
      <Handle type="source" position={Position.Top} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !bg-slate-400" />
      <Handle type="target" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-slate-400" />
      <p className="map-node-title line-clamp-3 text-[10px] font-semibold leading-relaxed text-gray-900">
        {cluster.title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <span
          className={cn(
            'inline-flex rounded-full border px-1 py-0.5 text-[8px] font-semibold uppercase',
            funnelStageClass(cluster.funnelStage)
          )}
        >
          {cluster.funnelStage}
        </span>
        <span className="inline-flex max-w-full truncate rounded-full border border-gray-200 bg-gray-50 px-1 py-0.5 text-[8px] text-gray-600">
          {cluster.searchIntent}
        </span>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] text-slate-600">
          Vol {formatMetric(cluster.searchVolume)}
        </span>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] text-slate-600">
          KD {formatMetric(cluster.keywordDifficulty)}
        </span>
      </div>
      <p className="map-node-hint mt-1 text-[8px] font-medium text-blue-600 opacity-80 group-hover:opacity-100">
        Click for details →
      </p>
    </div>
  );
});

const nodeTypes = {
  pillar: PillarMapNode,
  spoke: SpokeMapNode,
};

function buildGraph(map: HubSpokeMap): { nodes: Node<MapNodeData>[]; edges: Edge[] } {
  const pillarWidth = 220;
  const pillarHeight = 72;
  const spokeWidth = 170;
  const spokeHeight = 78;

  const nodes: Node<MapNodeData>[] = [
    {
      id: PILLAR_NODE_ID,
      type: 'pillar',
      position: {
        x: CANVAS_CENTER_X - pillarWidth / 2,
        y: CANVAS_CENTER_Y - pillarHeight / 2,
      },
      data: {
        kind: 'pillar',
        pillar: map.pillar,
      },
      draggable: false,
    },
  ];

  const titleToNodeId = new Map<string, string>();
  const edges: Edge[] = [];

  map.clusters.forEach((cluster, index) => {
    const id = spokeNodeId(cluster, index);
    titleToNodeId.set(normalizeTitle(cluster.title), id);

    const angle = (2 * Math.PI * index) / map.clusters.length - Math.PI / 2;
    const centerX = CANVAS_CENTER_X + SPOKE_RADIUS * Math.cos(angle);
    const centerY = CANVAS_CENTER_Y + SPOKE_RADIUS * Math.sin(angle);

    nodes.push({
      id,
      type: 'spoke',
      position: {
        x: centerX - spokeWidth / 2,
        y: centerY - spokeHeight / 2,
      },
      data: {
        kind: 'spoke',
        cluster,
      },
      draggable: false,
    });

    edges.push({
      id: `pillar-link-${id}`,
      source: id,
      target: PILLAR_NODE_ID,
      type: 'default',
      label: truncateLabel(cluster.anchorTextToPillar),
      style: { stroke: BRAND_BLUE, strokeWidth: 2 },
      labelStyle: { fill: '#1e40af', fontSize: 9, fontWeight: 500 },
      labelBgStyle: { fill: '#eff6ff', fillOpacity: 0.96 },
      labelBgPadding: [4, 3],
      labelBgBorderRadius: 3,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: BRAND_BLUE,
        width: 14,
        height: 14,
      },
    });
  });

  map.clusters.forEach((cluster, index) => {
    const sourceId = spokeNodeId(cluster, index);

    cluster.lateralLinks.forEach((link, linkIndex) => {
      const targetId = titleToNodeId.get(normalizeTitle(link.spokeTitle));
      if (!targetId || targetId === sourceId) {
        return;
      }

      edges.push({
        id: `lateral-${sourceId}-${targetId}-${linkIndex}`,
        source: sourceId,
        target: targetId,
        type: 'smoothstep',
        label: truncateLabel(link.suggestedLateralAnchorText, 18),
        style: { stroke: LATERAL_SLATE, strokeWidth: 1.25, strokeDasharray: '5 4' },
        labelStyle: { fill: '#64748b', fontSize: 8 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.96 },
        labelBgPadding: [3, 2],
        labelBgBorderRadius: 3,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: LATERAL_SLATE,
          width: 12,
          height: 12,
        },
      });
    });
  });

  return { nodes, edges };
}

function NodeDetailsDrawer({
  selected,
  open,
  onOpenChange,
}: {
  selected: SelectedNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!selected) {
    return null;
  }

  if (selected.kind === 'pillar') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-left leading-snug">{selected.pillar.title}</SheetTitle>
            <SheetDescription className={cn('text-left', hubKeywordClass)}>
              {selected.pillar.targetKeyword}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pillar Overview
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{selected.pillar.summary}</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Primary Call to Action
              </p>
              <p className="text-sm font-medium text-foreground">
                {selected.pillar.primaryCallToAction}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const { cluster } = selected;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left leading-snug">{cluster.title}</SheetTitle>
          <SheetDescription className={cn('text-left', hubKeywordClass)}>
            {cluster.targetKeyword}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              Vol {formatMetric(cluster.searchVolume)}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-[11px] text-muted-foreground">
              KD {formatMetric(cluster.keywordDifficulty)}
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

          <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500">
            <Link href={buildArticleStudioHref(cluster)}>
              <PenLine className="h-4 w-4" />
              Send Draft to Article Studio
              <ArrowRight className="ml-auto h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MapExportHandler({
  exportFilename,
  onExportReady,
  showCanvasExportButton = true,
}: {
  exportFilename: string;
  onExportReady?: (exportPng: (() => Promise<void>) | null) => void;
  showCanvasExportButton?: boolean;
}) {
  const { getNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPng = useCallback(async () => {
    const flowRoot = document.querySelector('.topical-map-flow') as HTMLElement | null;

    if (!flowRoot) {
      toast.error('Could not capture the map canvas.');
      return;
    }

    setIsExporting(true);
    ensureTopicalMapExportStyles();

    const nodeIds = getNodes().map(node => node.id);

    try {
      flowRoot.classList.add('is-exporting');
      nodeIds.forEach(id => updateNodeInternals(id));
      await waitForMapLayout(120);
      nodeIds.forEach(id => updateNodeInternals(id));
      await waitForMapLayout(80);

      const nodesBounds = getNodesBounds(getNodes());
      const { width: exportWidth, height: exportHeight, pixelRatio } =
        computeExportCanvasSize(nodesBounds);

      const exportViewport = getViewportForBounds(
        nodesBounds,
        exportWidth,
        exportHeight,
        0.1,
        1.1,
        0.18
      );

      const canvas = await captureTopicalMapPng(
        flowRoot,
        exportWidth,
        exportHeight,
        exportViewport,
        pixelRatio
      );

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('PNG encoding failed');
      }

      downloadPngBlob(blob, exportFilename);
      toast.success(`Map exported (${canvas.width}×${canvas.height}px).`);
    } catch {
      toast.error('Failed to export map. Please try again.');
    } finally {
      flowRoot.classList.remove('is-exporting');
      nodeIds.forEach(id => updateNodeInternals(id));
      setIsExporting(false);
    }
  }, [exportFilename, getNodes, updateNodeInternals]);

  useEffect(() => {
    onExportReady?.(handleExportPng);
    return () => onExportReady?.(null);
  }, [handleExportPng, onExportReady]);

  return (
    <>
      <MapCanvasToolbar
        isExporting={isExporting}
        onExport={handleExportPng}
        showExportButton={showCanvasExportButton}
      />
      {isExporting && (
        <Panel position="top-right" className="!m-3 !mt-14">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Exporting…
          </div>
        </Panel>
      )}
    </>
  );
}

function MapCanvasToolbar({
  isExporting,
  onExport,
  showExportButton = true,
}: {
  isExporting: boolean;
  onExport: () => Promise<void>;
  showExportButton?: boolean;
}) {
  return (
    <>
      <Panel position="top-left" className="!m-3">
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-1.5 text-xs text-blue-800 shadow-sm backdrop-blur-sm">
          <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
          <span>Click any node to view full details · Scroll to zoom · Drag to pan</span>
        </div>
      </Panel>

      {showExportButton ? (
        <Panel position="top-right" className="!m-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onExport()}
            disabled={isExporting}
            className="h-8 gap-1.5 !border-gray-300 !bg-white px-2.5 text-xs font-medium !text-gray-900 shadow-md hover:!bg-gray-50 hover:!text-gray-900"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export Map as PNG
          </Button>
        </Panel>
      ) : null}
    </>
  );
}

function MapFlowCanvas({
  nodes,
  edges,
  onNodeClick,
  exportFilename,
  onExportReady,
  showCanvasExportButton,
}: {
  nodes: Node<MapNodeData>[];
  edges: Edge[];
  onNodeClick: NodeMouseHandler;
  exportFilename: string;
  onExportReady?: (exportPng: (() => Promise<void>) | null) => void;
  showCanvasExportButton?: boolean;
}) {
  return (
    <ReactFlow
      className="topical-map-flow"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.2}
      maxZoom={2.5}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick
      panOnScroll={false}
      panOnDrag
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} color="#e5e7eb" />
      <Controls
        showZoom
        showFitView
        showInteractive={false}
        position="bottom-left"
        className="!rounded-lg !border !border-gray-200 !bg-white !shadow-sm"
      />
      <MiniMap
        nodeColor={node => (node.type === 'pillar' ? BRAND_BLUE : '#cbd5e1')}
        maskColor="rgba(255, 255, 255, 0.8)"
        className="!rounded-lg !border !border-gray-200 !shadow-sm"
        pannable
        zoomable
      />
      <MapExportHandler
        exportFilename={exportFilename}
        onExportReady={onExportReady}
        showCanvasExportButton={showCanvasExportButton}
      />
    </ReactFlow>
  );
}

type TopicalMapVisualizerProps = {
  map: HubSpokeMap;
  exportFilenamePrefix?: string;
  onExportReady?: (exportPng: (() => Promise<void>) | null) => void;
  showCanvasExportButton?: boolean;
};

export default function TopicalMapVisualizer({
  map,
  exportFilenamePrefix,
  onExportReady,
  showCanvasExportButton = true,
}: TopicalMapVisualizerProps) {
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    ensureTopicalMapExportStyles();
  }, []);

  const { nodes, edges } = useMemo(() => buildGraph(map), [map]);
  const exportFilename = useMemo(
    () => buildExportFilename(exportFilenamePrefix ?? map.pillar.targetKeyword),
    [exportFilenamePrefix, map.pillar.targetKeyword]
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const data = node.data as MapNodeData;

    if (data.kind === 'pillar') {
      setSelectedNode({ kind: 'pillar', pillar: data.pillar });
    } else {
      setSelectedNode({ kind: 'spoke', cluster: data.cluster });
    }
    setDrawerOpen(true);
  }, []);

  return (
    <>
      <div className="h-[700px] w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <MapFlowCanvas
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          exportFilename={exportFilename}
          onExportReady={onExportReady}
          showCanvasExportButton={showCanvasExportButton}
        />
      </div>

      <NodeDetailsDrawer
        selected={selectedNode}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}

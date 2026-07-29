'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, MousePointerClick } from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { buildSiloFlowGraph } from '@/lib/silo-builder/layout';
import { PillarNode, SpokeNode } from '@/components/silo-builder/nodes/SiloFlowNodes';
import type { SiloNodeDto } from '@/lib/silo-builder/types';
import {
  captureTopicalMapPng,
  computeExportCanvasSize,
  downloadPngBlob,
  ensureTopicalMapExportStyles,
  waitForMapLayout,
} from '@/lib/topical-map/export-styles';
import { toast } from '@/components/ui/sonner';

const nodeTypes = {
  pillar: PillarNode,
  spoke: SpokeNode,
};

type SiloMapViewProps = {
  nodes: SiloNodeDto[];
  selectedIds: Set<string>;
  exportFilename: string;
  onNodeClick: (node: SiloNodeDto) => void;
  onSelectionToggle: (nodeId: string) => void;
};

function SiloMapExportHandler({ exportFilename }: { exportFilename: string }) {
  const { getNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPng = useCallback(async () => {
    const flowRoot = document.querySelector('.silo-map-flow') as HTMLElement | null;

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

  return (
    <>
      <Panel position="top-left" className="!m-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/90 px-3 py-1.5 text-xs text-emerald-800 shadow-sm backdrop-blur-sm dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
          <span>Click any node to view full details · ⌘/Ctrl+click to select · Scroll to zoom · Drag to pan</span>
        </div>
      </Panel>

      <Panel position="top-right" className="!m-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleExportPng()}
          disabled={isExporting}
          className="h-8 gap-1.5 border-border bg-background px-2.5 text-xs shadow-sm"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export Map as PNG
        </Button>
      </Panel>

      {isExporting && (
        <Panel position="top-right" className="!m-3 !mt-14">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Exporting…
          </div>
        </Panel>
      )}
    </>
  );
}

function SiloMapCanvas({
  nodes,
  selectedIds,
  exportFilename,
  onNodeClick,
  onSelectionToggle,
}: SiloMapViewProps) {
  const { nodes: flowNodes, edges } = useMemo(
    () => buildSiloFlowGraph(nodes),
    [nodes]
  );

  const styledNodes = useMemo(
    () =>
      flowNodes.map(n => ({
        ...n,
        selected: selectedIds.has(n.id),
      })),
    [flowNodes, selectedIds]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, flowNode) => {
      const siloNode = nodes.find(n => n.id === flowNode.id);
      if (!siloNode) return;

      if (_event.metaKey || _event.ctrlKey) {
        onSelectionToggle(siloNode.id);
      } else {
        onNodeClick(siloNode);
      }
    },
    [nodes, onNodeClick, onSelectionToggle]
  );

  return (
    <div className="h-[700px] w-full rounded-xl border border-border bg-card shadow-sm">
      <ReactFlow
        className="silo-map-flow"
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={1.5}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        panOnScroll={false}
        panOnDrag
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#e5e7eb" />
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          position="bottom-left"
          className="!rounded-lg !border !border-border !bg-background !shadow-sm"
        />
        <MiniMap
          nodeColor={n => (n.type === 'pillar' ? '#2563eb' : '#cbd5e1')}
          maskColor="rgba(255, 255, 255, 0.8)"
          className="!rounded-lg !border !border-border !shadow-sm"
          pannable
          zoomable
        />
        <SiloMapExportHandler exportFilename={exportFilename} />
      </ReactFlow>
    </div>
  );
}

function buildSiloMapExportFilename(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `silo-map-${slug || 'export'}.png`;
}

export default function SiloMapView({
  exportFilename: exportFilenameProp,
  ...props
}: SiloMapViewProps) {
  useEffect(() => {
    ensureTopicalMapExportStyles();
  }, []);

  const exportFilename = useMemo(
    () => exportFilenameProp || 'silo-map-export.png',
    [exportFilenameProp]
  );

  return (
    <ReactFlowProvider>
      <SiloMapCanvas {...props} exportFilename={exportFilename} />
    </ReactFlowProvider>
  );
}

export { buildSiloMapExportFilename };

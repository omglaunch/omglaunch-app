'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import type { SiloNodeDto } from '@/lib/silo-builder/types';
import { getMetricsFreshness } from '@/lib/silo-builder/metrics-freshness';
import { cn } from '@/lib/utils';

type SiloNodeData = {
  node: SiloNodeDto;
};

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString();
}

function formatAsOf(enrichedAt: string | null | undefined): string | null {
  const freshness = getMetricsFreshness(enrichedAt);
  if (!freshness.shortDate) {
    return null;
  }
  return freshness.isStale
    ? `stale ${freshness.shortDate}`
    : freshness.shortDate;
}

function statusBorderClass(status: SiloNodeDto['status']): string {
  switch (status) {
    case 'PUBLISHED':
      return 'border-emerald-300 dark:border-violet-300';
    case 'COMPLETED':
      return 'border-emerald-300';
    case 'GENERATING':
    case 'QUEUED':
      return 'border-amber-300';
    case 'FAILED':
      return 'border-red-300';
    default:
      return 'border-gray-200';
  }
}

export const PillarNode = memo(function PillarNode({ data }: NodeProps<SiloNodeData>) {
  const { node } = data;
  const asOf = formatAsOf(node.enrichedAt);

  return (
    <div
      className={cn(
        'map-node-card map-node-card--pillar group w-[220px] cursor-pointer overflow-visible rounded-xl border-2 border-emerald-600 bg-gradient-to-br from-emerald-50 via-white to-white px-3 py-2.5 shadow-md transition-shadow hover:shadow-lg dark:border-[#2563eb] dark:from-blue-50',
        statusBorderClass(node.status)
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="target" position={Position.Right} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="target" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Badge className="bg-[#2563eb] text-[9px] hover:bg-[#2563eb]">Core Pillar</Badge>
      <p className="map-node-title mt-1.5 line-clamp-3 text-[11px] font-semibold leading-relaxed text-gray-900">
        {node.title}
      </p>
      <p className="map-node-keyword mt-1 truncate text-[9px] text-gray-500">{node.targetKeyword}</p>
      <div className="mt-1 flex flex-wrap gap-2 text-[8px] text-slate-600">
        <span>Vol {formatMetric(node.searchVolume)}</span>
        <span>KD {formatMetric(node.difficulty)}</span>
        {asOf ? <span className="text-slate-500">· {asOf}</span> : null}
      </div>
      <p className="map-node-hint mt-1 text-[9px] font-medium text-emerald-600 opacity-80 group-hover:opacity-100 dark:text-blue-600">
        Click for details · ⌘/Ctrl+click to select →
      </p>
    </div>
  );
});

export const SpokeNode = memo(function SpokeNode({ data }: NodeProps<SiloNodeData>) {
  const { node } = data;
  const asOf = formatAsOf(node.enrichedAt);

  return (
    <div
      className={cn(
        'map-node-card map-node-card--spoke group w-[170px] cursor-pointer overflow-visible rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition-shadow hover:border-emerald-200 hover:shadow-md dark:hover:border-blue-200',
        statusBorderClass(node.status)
      )}
    >
      <Handle type="source" position={Position.Top} className="!h-1.5 !w-1.5 !bg-[#2563eb]" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-slate-400" />
      <Handle type="source" position={Position.Left} className="!h-1.5 !w-1.5 !bg-slate-400" />
      <p className="map-node-title line-clamp-3 text-[10px] font-semibold leading-relaxed text-gray-900">
        {node.title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {node.intent && (
          <span className="inline-flex max-w-full truncate rounded-full border border-gray-200 bg-gray-50 px-1 py-0.5 text-[8px] text-gray-600">
            {node.intent}
          </span>
        )}
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] text-slate-600">
          Vol {formatMetric(node.searchVolume)}
        </span>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] text-slate-600">
          KD {formatMetric(node.difficulty)}
        </span>
        {asOf ? (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] text-slate-500">
            {asOf}
          </span>
        ) : null}
      </div>
      <p className="map-node-hint mt-1 text-[8px] font-medium text-emerald-600 opacity-80 group-hover:opacity-100 dark:text-blue-600">
        Click for details · ⌘/Ctrl+click to select →
      </p>
    </div>
  );
});

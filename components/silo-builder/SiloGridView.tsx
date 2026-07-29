'use client';

import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import SiloMetricsConfidenceBadge from '@/components/silo-builder/SiloMetricsConfidenceBadge';
import {
  siloActionLinkClass,
  siloBodyTextClass,
  siloKeywordClass,
  siloMetaBadgeClass,
  siloNeutralBadgeClass,
  siloSectionLabelClass,
  siloSpokeBadgeClass,
  siloStatusBadgeClass,
  siloStatusLabel,
} from '@/components/silo-builder/silo-theme';
import type { SiloNodeDto } from '@/lib/silo-builder/types';
import { getMetricsFreshness } from '@/lib/silo-builder/metrics-freshness';
import { cn } from '@/lib/utils';

type SiloGridViewProps = {
  nodes: SiloNodeDto[];
  selectedIds: Set<string>;
  highlightedNodeId?: string | null;
  onNodeClick: (node: SiloNodeDto) => void;
  onSelectionToggle: (nodeId: string) => void;
};

function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString();
}

function SpokeCard({
  node,
  selected,
  highlighted,
  onToggleSelect,
  onNodeClick,
}: {
  node: SiloNodeDto;
  selected: boolean;
  highlighted: boolean;
  onToggleSelect: (nodeId: string) => void;
  onNodeClick: (node: SiloNodeDto) => void;
}) {
  return (
    <Card
      data-silo-node-id={node.id}
      className={cn(
        'flex h-full cursor-pointer flex-col border-border shadow-sm transition-shadow hover:shadow-md',
        highlighted && 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background dark:ring-violet-500'
      )}
      onClick={() => onNodeClick(node)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug text-foreground">{node.title}</CardTitle>
            <CardDescription className={cn('text-xs font-medium', siloKeywordClass)}>
              {node.targetKeyword ?? 'No keyword'}
              {node.originalTargetKeyword ? (
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  Resolved from: {node.originalTargetKeyword}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(node.id)}
            onClick={event => event.stopPropagation()}
            aria-label={`Select ${node.title}`}
            className="mt-0.5 shrink-0"
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn('text-[11px]', siloSpokeBadgeClass)}>
            SPOKE
          </Badge>
          {node.funnelStage && (
            <Badge variant="outline" className={cn('text-[11px]', siloNeutralBadgeClass)}>
              {node.funnelStage}
            </Badge>
          )}
          {node.intent && (
            <Badge variant="outline" className={cn('text-[11px]', siloNeutralBadgeClass)}>
              {node.intent}
            </Badge>
          )}
          <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
            Vol {formatMetricValue(node.searchVolume)}
          </Badge>
          <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
            KD {formatMetricValue(node.difficulty)}
          </Badge>
          {node.enrichedAt ? (
            <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
              {getMetricsFreshness(node.enrichedAt).label}
            </Badge>
          ) : null}
          <SiloMetricsConfidenceBadge confidence={node.metricsConfidence} />
          <Badge variant="outline" className={cn('text-[11px]', siloStatusBadgeClass(node.status))}>
            {siloStatusLabel(node.status, node.wpPostStatus)}
          </Badge>
        </div>

        {(node.summary || node.intent) && (
          <p className={cn('line-clamp-3 text-sm leading-relaxed', siloBodyTextClass)}>
            {node.summary ?? node.intent}
          </p>
        )}

        <p className={cn('mt-auto text-xs', siloActionLinkClass)}>
          {(node.status === 'COMPLETED' || node.status === 'PUBLISHED') && node.content
            ? 'Click to view generated article →'
            : 'Use checkbox to select · Click to inspect →'}
        </p>
      </CardContent>
    </Card>
  );
}

export default function SiloGridView({
  nodes,
  selectedIds,
  highlightedNodeId = null,
  onNodeClick,
  onSelectionToggle,
}: SiloGridViewProps) {
  const pillar = nodes.find(node => node.type === 'PILLAR');
  const spokes = nodes.filter(node => node.type === 'SPOKE');

  if (!pillar) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center text-sm text-muted-foreground">
        No pillar node found in this silo.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div
        className={cn(
          'flex items-center gap-2 text-xs font-semibold uppercase tracking-wide',
          siloSectionLabelClass
        )}
      >
        <span className="h-px flex-1 bg-border" />
        Pillar Page
        <span className="h-px flex-1 bg-border" />
      </div>

      <Card
        className={cn(
          'cursor-pointer border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-card to-card shadow-md transition-shadow hover:shadow-lg dark:border-indigo-900/50 dark:from-indigo-950/40 dark:via-card dark:to-card',
          selectedIds.has(pillar.id) && 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background dark:ring-indigo-500'
        )}
        onClick={() => onNodeClick(pillar)}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Badge className="mb-3 bg-emerald-600 hover:bg-emerald-600 dark:bg-indigo-500 dark:hover:bg-indigo-500">
                Core Pillar
              </Badge>
              <CardTitle className="text-2xl leading-tight text-foreground">{pillar.title}</CardTitle>
              <CardDescription className={cn('mt-2 text-sm font-medium', siloKeywordClass)}>
                Target keyword: {pillar.targetKeyword ?? 'N/A'}
                {pillar.originalTargetKeyword ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Resolved from: {pillar.originalTargetKeyword}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <Checkbox
                checked={selectedIds.has(pillar.id)}
                onCheckedChange={() => onSelectionToggle(pillar.id)}
                onClick={event => event.stopPropagation()}
                aria-label={`Select ${pillar.title}`}
                className="mt-1"
              />
              <Target className="h-8 w-8 text-emerald-500 dark:text-indigo-300" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {pillar.intent && (
              <Badge variant="outline" className={cn('text-[11px]', siloNeutralBadgeClass)}>
                {pillar.intent}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
              Vol {formatMetricValue(pillar.searchVolume)}
            </Badge>
            <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
              KD {formatMetricValue(pillar.difficulty)}
            </Badge>
            {pillar.enrichedAt ? (
              <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
                {getMetricsFreshness(pillar.enrichedAt).label}
              </Badge>
            ) : null}
            <SiloMetricsConfidenceBadge confidence={pillar.metricsConfidence} />
            <Badge variant="outline" className={cn('text-[11px]', siloStatusBadgeClass(pillar.status))}>
              {siloStatusLabel(pillar.status, pillar.wpPostStatus)}
            </Badge>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-indigo-800 dark:bg-indigo-950">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-indigo-400">
              Pillar Overview
            </p>
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-indigo-100">
              {pillar.summary ??
                `Central hub page anchoring topical authority for ${pillar.targetKeyword ?? 'this silo'}. All spoke pages link back to this pillar to distribute PageRank and semantic relevance.`}
            </p>
          </div>
          <p className={cn('text-xs', siloActionLinkClass)}>
            {(pillar.status === 'COMPLETED' || pillar.status === 'PUBLISHED') && pillar.content
              ? 'Click to view generated article →'
              : 'Use checkbox to select · Click to inspect →'}
          </p>
        </CardContent>
      </Card>

      <div
        className={cn(
          'flex items-center gap-2 text-xs font-semibold uppercase tracking-wide',
          siloSectionLabelClass
        )}
      >
        <span className="h-px flex-1 bg-border" />
        {spokes.length} Spoke Pages
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {spokes.map(node => (
          <SpokeCard
            key={node.id}
            node={node}
            selected={selectedIds.has(node.id)}
            highlighted={highlightedNodeId === node.id}
            onToggleSelect={onSelectionToggle}
            onNodeClick={onNodeClick}
          />
        ))}
      </div>
    </div>
  );
}

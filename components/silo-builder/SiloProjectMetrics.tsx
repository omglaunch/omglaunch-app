'use client';

import { GitBranch, Layers, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { computeSiloProjectMetrics } from '@/lib/silo-builder/metrics';
import { getMetricsFreshness } from '@/lib/silo-builder/metrics-freshness';
import type { SiloNodeDto } from '@/lib/silo-builder/types';

type SiloProjectMetricsProps = {
  nodes: SiloNodeDto[];
  metricsEnrichedAt?: string | null;
};

function formatTrafficPool(value: number | null): string {
  if (value === null) return 'N/A';
  return value.toLocaleString();
}

function formatCompetitiveIndex(value: number | null): string {
  if (value === null) return 'N/A';
  return String(value);
}

export default function SiloProjectMetrics({
  nodes,
  metricsEnrichedAt,
}: SiloProjectMetricsProps) {
  const metrics = computeSiloProjectMetrics(nodes);
  const freshness = getMetricsFreshness(metricsEnrichedAt);

  const items = [
    {
      label: 'Total Cluster Traffic Pool',
      value: formatTrafficPool(metrics.totalTrafficPool),
      hint: freshness.label
        ? `Combined spoke volume · ${freshness.label}`
        : 'Combined monthly search volume across all spokes',
    },
    {
      label: 'Silo Competitive Index',
      value: formatCompetitiveIndex(metrics.competitiveIndex),
      hint:
        metrics.verifiedSpokeCount > 0
          ? `Verified KD from ${metrics.verifiedSpokeCount}/${metrics.totalSpokeCount} spokes${
              freshness.label ? ` · ${freshness.label}` : ''
            }`
          : 'No verified spoke difficulty data yet',
    },
    {
      label: 'Architectural Connections',
      value: metrics.architecturalConnections.toLocaleString(),
      hint: 'Pillar-to-spoke links in this silo',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map(item => {
        const Icon =
          item.label === 'Total Cluster Traffic Pool'
            ? TrendingUp
            : item.label === 'Silo Competitive Index'
              ? Layers
              : GitBranch;

        return (
          <Card key={item.label} className="border-border shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                  item.label === 'Architectural Connections'
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-violet-300 dark:bg-violet-950/50 dark:border-violet-900/50'
                    : item.label === 'Silo Competitive Index'
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-900/50'
                      : 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-indigo-300 dark:bg-indigo-950/50 dark:border-indigo-900/50'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.hint}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

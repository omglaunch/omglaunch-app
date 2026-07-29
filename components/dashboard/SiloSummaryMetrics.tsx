'use client';

import { GitBranch, Layers, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { computeSiloSummaryMetrics } from '@/lib/topical-map/silo-metrics';
import type { HubSpokeMap } from '@/lib/hub-spoke-data';

type SiloSummaryMetricsProps = {
  map: HubSpokeMap;
};

function formatTrafficPool(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }
  return value.toLocaleString();
}

function formatCompetitiveIndex(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }
  return String(value);
}

export default function SiloSummaryMetrics({ map }: SiloSummaryMetricsProps) {
  const metrics = computeSiloSummaryMetrics(map);

  const items = [
    {
      label: 'Total Cluster Traffic Pool',
      value: formatTrafficPool(metrics.totalTrafficPool),
      hint: 'Combined monthly search volume across all spokes',
      icon: TrendingUp,
      accent: 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    {
      label: 'Silo Competitive Index',
      value: formatCompetitiveIndex(metrics.competitiveIndex),
      hint: 'Volume-weighted average keyword difficulty',
      icon: Layers,
      accent: 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    {
      label: 'Architectural Connections',
      value: metrics.architecturalConnections.toLocaleString(),
      hint: 'Pillar links plus spoke-to-spoke lateral links',
      icon: GitBranch,
      accent: 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map(item => {
        const Icon = item.icon;

        return (
          <Card key={item.label} className="border-border shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.accent}`}
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

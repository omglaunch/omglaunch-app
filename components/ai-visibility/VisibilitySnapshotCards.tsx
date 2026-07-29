'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Crosshair,
  Layers,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisibilitySnapshot } from '@/lib/ai-visibility/types';
import { formatDeltaPct, formatSharePct } from '@/lib/ai-visibility/utils';

type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'zinc';

const TONE: Record<Tone, string> = {
  emerald:
    'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  sky: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  zinc: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: Tone;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          )}
          {hint ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            TONE[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function VisibilitySnapshotCards({
  snapshot,
  loading,
}: {
  snapshot: VisibilitySnapshot | null;
  loading: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Total Citation Share"
        value={
          snapshot ? formatSharePct(snapshot.totalCitationShare) : '—'
        }
        hint="Top-3 Citations ÷ (Active Prompts × Engines)"
        icon={Share2}
        tone="emerald"
        loading={loading}
      />
      <SummaryCard
        label="Prompt Clusters Tracked"
        value={snapshot ? String(snapshot.promptClustersTracked) : '—'}
        icon={Layers}
        tone="sky"
        loading={loading}
      />
      <SummaryCard
        label="Top 3 Citations Secured"
        value={snapshot ? snapshot.top3CitationsSecured.toLocaleString() : '—'}
        hint="Cross-engine"
        icon={Award}
        tone="amber"
        loading={loading}
      />
      <SummaryCard
        label="Competitor Delta (SoV)"
        value={
          snapshot
            ? formatDeltaPct(snapshot.competitorDeltaShareOfVoice)
            : '—'
        }
        icon={Crosshair}
        tone={
          snapshot && snapshot.competitorDeltaShareOfVoice >= 0
            ? 'emerald'
            : 'rose'
        }
        loading={loading}
      />
    </div>
  );
}

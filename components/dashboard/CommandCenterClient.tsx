'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Globe2,
  Languages,
  Radar,
  TrendingUp,
} from 'lucide-react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CommandCenterData } from '@/lib/dashboard/command-center';
import LegacyDataMigrationBanner from '@/components/dashboard/LegacyDataMigrationBanner';
import { cn } from '@/lib/utils';

type CommandCenterClientProps = {
  data: CommandCenterData;
  hasLegacyData?: boolean;
};

function KpiCard({
  label,
  value,
  subtitle,
  accentClass,
}: {
  label: string;
  value: string;
  subtitle: string;
  accentClass?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-sm',
        accentClass
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function GatheringDataPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <Radar className="h-6 w-6 animate-pulse text-blue-600" />
      </div>
      <h3 className="text-base font-semibold text-foreground">Gathering Data…</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function VisibilityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-blue-600">
        Visibility: <span className="font-semibold">{payload[0]?.value ?? 0}%</span>
      </p>
    </div>
  );
}

function VisibilityTrendChart({
  data,
  isPlaceholder,
}: {
  data: CommandCenterData['visibilityTrend'];
  isPlaceholder: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Organic Visibility</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPlaceholder
              ? 'Preview trend — live data populates as rank history builds'
              : '14-day visibility index from rank history'}
          </p>
        </div>
        <TrendingUp className="h-4 w-4 text-blue-600" aria-hidden />
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              width={36}
            />
            <Tooltip content={<VisibilityTooltip />} />
            <Line
              type="monotone"
              dataKey="visibility"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RankDistributionChart({
  data,
}: {
  data: CommandCenterData['rankDistribution'];
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const chartData = data.filter(slice => slice.value > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Rank Distribution</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Current position buckets across tracked keywords
        </p>
      </div>
      {total === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          No ranked keywords yet
        </div>
      ) : (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {chartData.map(entry => (
                    <Cell key={entry.key} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, item) => [
                    `${value} keywords`,
                    item.payload.label,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {data.map(slice => (
              <li
                key={slice.key}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  {slice.label}
                </span>
                <span className="tabular-nums">{slice.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MiniTable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MoverList({
  rows,
  direction,
}: {
  rows: CommandCenterData['topMovers'];
  direction: 'up' | 'down';
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No movement in the last 24 hours.</p>;
  }

  const Icon = direction === 'up' ? ArrowUpRight : ArrowDownRight;
  const tone = direction === 'up' ? 'text-emerald-600' : 'text-red-500';

  return (
    <ul className="space-y-2">
      {rows.map(row => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.keyword}</p>
            <p className="text-xs text-muted-foreground">
              SV {row.searchVolume.toLocaleString()}
            </p>
          </div>
          <span className={cn('inline-flex items-center gap-1 text-sm font-semibold tabular-nums', tone)}>
            <Icon className="h-3.5 w-3.5" />
            {direction === 'up' ? '+' : ''}
            {row.delta}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ThreatList({ rows }: { rows: CommandCenterData['activeThreats'] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No active cannibalization or intent threats.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map(row => (
        <li key={row.id} className="rounded-lg bg-muted px-3 py-2">
          <Link
            href="/rank-tracker"
            className="block truncate text-sm font-medium text-blue-700 hover:underline"
          >
            {row.keyword}
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.warnings.map(warning => (
              <span
                key={warning}
                className={cn(
                  'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium',
                  warning === 'Cannibalization'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-orange-50 text-orange-700'
                )}
              >
                ⚠️ {warning}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CommandCenterClient({
  data,
  hasLegacyData = false,
}: CommandCenterClientProps) {
  const showGatheringState = !data.hasKeywords || !data.hasRankingData;

  return (
    <div className="space-y-6">
      <LegacyDataMigrationBanner initialVisible={hasLegacyData} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unified SEO pulse for{' '}
            <span className="font-medium text-foreground">
              {data.project?.brandLabel ?? data.project?.name ?? 'your client'}
            </span>
          </p>
        </div>
        {data.project ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5 text-blue-600" />
              {data.project.geoTarget}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Languages className="h-3.5 w-3.5 text-blue-600" />
              {data.project.language}
            </span>
            {data.project.domain ? (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {data.project.domain}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Keywords"
          value={data.kpis.totalKeywords.toLocaleString()}
          subtitle="Compared to 24h ago"
        />
        <KpiCard
          label="Average Position"
          value={data.kpis.averageRank != null ? String(data.kpis.averageRank) : '—'}
          subtitle="Compared to 24h ago"
        />
        <KpiCard
          label="Share of Voice"
          value={`${data.kpis.shareOfVoice}%`}
          subtitle="Top 20 weighted by search volume"
        />
        <KpiCard
          label="Critical Threats"
          value={String(data.kpis.criticalThreats)}
          subtitle="Cannibalization or wrong-page ranking"
          accentClass={
            data.kpis.criticalThreats > 0
              ? 'border-red-200 bg-red-50/40'
              : undefined
          }
        />
      </div>

      {showGatheringState ? (
        <GatheringDataPanel
          message={
            !data.hasKeywords
              ? 'Add keywords to your active project in Rank Tracker or Research Hub to begin aggregating performance metrics.'
              : 'Rank snapshots are still syncing. Charts will populate automatically once tracking history is available.'
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <VisibilityTrendChart
              data={data.visibilityTrend}
              isPlaceholder={data.usesPlaceholderTrend}
            />
          </div>
          <div className="lg:col-span-1">
            <RankDistributionChart data={data.rankDistribution} />
          </div>
        </div>
      )}

      {!showGatheringState ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <MiniTable title="Top Movers">
            <MoverList rows={data.topMovers} direction="up" />
          </MiniTable>
          <MiniTable title="Top Drops">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Declining keywords</span>
              <Link
                href="/revenue-rescue"
                className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Open Revenue Rescue
              </Link>
            </div>
            <MoverList rows={data.topDrops} direction="down" />
          </MiniTable>
          <MiniTable title="Active Threats">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Review in Rank Tracker
              </span>
              <span aria-hidden>·</span>
              <Link
                href="/revenue-rescue?segment=content-decay"
                className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Reclaim in Revenue Rescue
              </Link>
            </div>
            <ThreatList rows={data.activeThreats} />
          </MiniTable>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {['Top Movers', 'Top Drops', 'Active Threats'].map(title => (
            <div
              key={title}
              className="rounded-xl border border-dashed border-border bg-card p-5 text-center shadow-sm"
            >
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-6 text-sm text-muted-foreground">Gathering Data…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

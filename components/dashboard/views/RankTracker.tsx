'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Search, Eye, ChevronUp, ChevronDown, Minus, Save } from 'lucide-react';
import { useProject } from '@/components/projects/ProjectProvider';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';

const RANK_DATA = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  return {
    day: `Jun ${day}`,
    'omglaunch.io': Math.max(1, Math.round(8 - Math.sin(i / 3) * 4 + Math.random() * 2)),
    'competitor.com': Math.max(1, Math.round(12 - Math.cos(i / 4) * 3 + Math.random() * 3)),
  };
});

interface KeywordRow {
  keyword: string;
  position: number;
  change: number;
  volume: number;
  engine: 'Google' | 'Perplexity' | 'ChatGPT';
}

const KEYWORDS: KeywordRow[] = [
  { keyword: 'seo ai analysis tool', position: 3, change: 2, volume: 8100, engine: 'Google' },
  { keyword: 'ai content optimization', position: 7, change: -1, volume: 5400, engine: 'Google' },
  { keyword: 'geo score checker', position: 1, change: 0, volume: 2900, engine: 'Perplexity' },
  { keyword: 'best seo audit software', position: 5, change: 3, volume: 12000, engine: 'Google' },
  { keyword: 'ai seo workflow', position: 2, change: 1, volume: 4800, engine: 'ChatGPT' },
  { keyword: 'rank tracker with ai', position: 9, change: -3, volume: 3200, engine: 'Google' },
  { keyword: 'semantic seo analysis', position: 4, change: 0, volume: 2100, engine: 'Perplexity' },
  { keyword: 'json-ld validator seo', position: 6, change: 2, volume: 1700, engine: 'Google' },
  { keyword: 'content readability score', position: 11, change: -2, volume: 9400, engine: 'ChatGPT' },
  { keyword: 'ai share of voice seo', position: 2, change: 4, volume: 1300, engine: 'Perplexity' },
];

function engineBadge(engine: KeywordRow['engine']) {
  const map: Record<KeywordRow['engine'], string> = {
    Google: 'bg-blue-50 text-blue-700 border-blue-200',
    Perplexity: 'bg-violet-50 text-violet-700 border-violet-200',
    ChatGPT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return map[engine];
}

function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <div className="flex items-center gap-1 text-muted-foreground text-xs"><Minus size={12} /><span>—</span></div>;
  if (change > 0) return (
    <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
      <ChevronUp size={14} /><span>+{change}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <ChevronDown size={14} /><span>{change}</span>
    </div>
  );
}

export default function RankTracker() {
  const { activeProjectId } = useProject();
  const [query, setQuery] = useState('');
  const {
    entries,
    isLoading,
    activeId,
    save,
    remove,
    setActiveId,
  } = useToolHistory('rank-tracker', {
    limit: 25,
    workspaceId: activeProjectId,
  });

  useEffect(() => {
    setQuery('');
    setActiveId(null);
  }, [activeProjectId, setActiveId]);

  const filtered = KEYWORDS.filter(k =>
    k.keyword.toLowerCase().includes(query.toLowerCase())
  );

  const avgPosition = (KEYWORDS.reduce((s, k) => s + k.position, 0) / KEYWORDS.length).toFixed(1);
  const aiSov = '34%';
  const totalKeywords = KEYWORDS.length;

  async function saveSnapshot() {
    const identifier = query.trim() || `portfolio-${new Date().toISOString().slice(0, 10)}`;
    await save({
      identifier,
      workspaceId: activeProjectId,
      resultData: {
        query,
        avgPosition,
        aiSov,
        totalKeywords,
        keywords: filtered,
        rankData: RANK_DATA,
        savedAt: new Date().toISOString(),
        projectId: activeProjectId,
      },
    });
  }

  return (
    <div className="min-h-full p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-xl font-semibold text-foreground">Rank Tracker</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Historical SERP and AI Share-of-Voice positions</p>
        </div>
        <button
          type="button"
          onClick={() => void saveSnapshot()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
        >
          <Save size={15} />
          Save Snapshot
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-2">
            <TrendingUp size={14} />
            Avg. Position
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{avgPosition}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-2">
            <Eye size={14} />
            AI Share of Voice
          </div>
          <p className="text-2xl font-bold text-violet-600 tabular-nums">{aiSov}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-2">
            <Search size={14} />
            Tracked Keywords
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{totalKeywords}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">30-Day Position Trend</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={RANK_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis reversed tick={{ fontSize: 11 }} stroke="#9ca3af" domain={[1, 20]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="omglaunch.io" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="competitor.com" stroke="#9ca3af" strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Keyword table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">Keyword Positions</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter keywords…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-blue-100 w-48"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Keyword</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Position</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Change</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Volume</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(row => (
                <tr key={row.keyword} className="hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{row.keyword}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground">#{row.position}</td>
                  <td className="px-4 py-3"><ChangeIndicator change={row.change} /></td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.volume.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${engineBadge(row.engine)}`}>
                      {row.engine}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </div>

        <ToolHistoryPanel
          title="Saved Snapshots"
          description="Rank tracking snapshots stored in your workspace."
          entries={entries}
          activeId={activeId}
          isLoading={isLoading}
          emptyMessage="No snapshots saved yet. Click Save Snapshot to store your current view."
          onLoad={entry => setActiveId(entry.id)}
          onDelete={id => void remove(id)}
        />
      </div>
    </div>
  );
}

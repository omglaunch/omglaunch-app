import {
  isIntentMismatch,
  parseCompetingPagesJson,
} from '@/lib/rank-tracker/cannibalization';
import { UNRANKED_POSITION } from '@/lib/rank-tracker/types';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { getServerActiveProjectId, getServerActiveClientBrand } from '@/lib/projects/active-project-server';
import { assertProjectAccess } from '@/lib/projects/team-access';
import { getPrisma } from '@/lib/prisma';

export type RankDistributionSlice = {
  key: 'top3' | 'page1' | 'page2' | 'deep' | 'lost';
  label: string;
  value: number;
  color: string;
};

export type VisibilityTrendPoint = {
  date: string;
  visibility: number;
};

export type MoverRow = {
  id: string;
  keyword: string;
  searchVolume: number;
  delta: number;
  impact: number;
};

export type ThreatRow = {
  id: string;
  keyword: string;
  warnings: Array<'Cannibalization' | 'Wrong Page'>;
};

export type CommandCenterData = {
  project: {
    id: string;
    name: string;
    brandLabel: string;
    domain: string | null;
    geoTarget: string;
    language: string;
  } | null;
  hasKeywords: boolean;
  hasRankingData: boolean;
  usesPlaceholderTrend: boolean;
  kpis: {
    totalKeywords: number;
    averageRank: number | null;
    shareOfVoice: number;
    criticalThreats: number;
  };
  rankDistribution: RankDistributionSlice[];
  visibilityTrend: VisibilityTrendPoint[];
  topMovers: MoverRow[];
  topDrops: MoverRow[];
  activeThreats: ThreatRow[];
};

function isUnranked(rank: number | null | undefined): boolean {
  return rank == null || rank <= 0 || rank >= UNRANKED_POSITION;
}

function hasCriticalThreat(keyword: {
  competingPages: string | null;
  targetUrl: string | null;
  rankedUrl: string | null;
  currentRank: number | null;
}): boolean {
  const competing = parseCompetingPagesJson(keyword.competingPages);
  if (competing && competing.length > 0) return true;
  return isIntentMismatch(keyword.targetUrl, keyword.rankedUrl, keyword.currentRank);
}

function getThreatWarnings(keyword: {
  competingPages: string | null;
  targetUrl: string | null;
  rankedUrl: string | null;
  currentRank: number | null;
}): Array<'Cannibalization' | 'Wrong Page'> {
  const warnings: Array<'Cannibalization' | 'Wrong Page'> = [];
  const competing = parseCompetingPagesJson(keyword.competingPages);
  if (competing && competing.length > 0) {
    warnings.push('Cannibalization');
  }
  if (isIntentMismatch(keyword.targetUrl, keyword.rankedUrl, keyword.currentRank)) {
    warnings.push('Wrong Page');
  }
  return warnings;
}

function computeAverageRank(
  keywords: Array<{ currentRank: number | null }>
): number | null {
  const ranked = keywords.filter(keyword => !isUnranked(keyword.currentRank));
  if (ranked.length === 0) return null;
  const sum = ranked.reduce((total, keyword) => total + keyword.currentRank!, 0);
  return Math.round((sum / ranked.length) * 10) / 10;
}

function computeShareOfVoice(
  keywords: Array<{ currentRank: number | null; searchVolume: number | null }>
): number {
  const totalSv = keywords.reduce(
    (sum, keyword) => sum + Math.max(keyword.searchVolume ?? 0, 0),
    0
  );
  if (totalSv === 0) return 0;

  const topTwenty = keywords.filter(
    keyword =>
      keyword.currentRank != null &&
      keyword.currentRank >= 1 &&
      keyword.currentRank <= 20
  );

  const weighted = topTwenty.reduce((sum, keyword) => {
    const sv = Math.max(keyword.searchVolume ?? 0, 0);
    return sum + sv / keyword.currentRank!;
  }, 0);

  return Math.round((weighted / totalSv) * 100);
}

function getComparisonRank(
  history: Array<{ checkedAt: Date; position: number }>,
  now: Date
): number | null {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(yesterday);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(yesterday);
  dayEnd.setHours(23, 59, 59, 999);

  const yesterdayEntry = history.find(
    entry => entry.checkedAt >= dayStart && entry.checkedAt <= dayEnd
  );
  if (yesterdayEntry) return yesterdayEntry.position;

  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const olderEntry = history.find(entry => entry.checkedAt <= cutoff);
  return olderEntry?.position ?? null;
}

function buildMoverRows(
  keywords: Array<{
    id: string;
    keyword: string;
    searchVolume: number | null;
    currentRank: number | null;
    history: Array<{ checkedAt: Date; position: number }>;
  }>,
  now: Date
): { movers: MoverRow[]; drops: MoverRow[] } {
  const rows: MoverRow[] = [];

  for (const keyword of keywords) {
    if (isUnranked(keyword.currentRank)) continue;

    const previousRank = getComparisonRank(keyword.history, now);
    if (previousRank == null || isUnranked(previousRank)) continue;

    const delta = previousRank - keyword.currentRank!;
    if (delta === 0) continue;

    const searchVolume = Math.max(keyword.searchVolume ?? 0, 0);
    rows.push({
      id: keyword.id,
      keyword: keyword.keyword,
      searchVolume,
      delta,
      impact: delta * searchVolume,
    });
  }

  const movers = [...rows]
    .filter(row => row.delta > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5);

  const drops = [...rows]
    .filter(row => row.delta < 0)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 5);

  return { movers, drops };
}

function buildRankDistribution(
  keywords: Array<{ currentRank: number | null }>
): RankDistributionSlice[] {
  const buckets = {
    top3: 0,
    page1: 0,
    page2: 0,
    deep: 0,
    lost: 0,
  };

  for (const keyword of keywords) {
    const rank = keyword.currentRank;
    if (isUnranked(rank)) {
      buckets.lost += 1;
      continue;
    }
    if (rank! <= 3) buckets.top3 += 1;
    else if (rank! <= 10) buckets.page1 += 1;
    else if (rank! <= 20) buckets.page2 += 1;
    else buckets.deep += 1;
  }

  return [
    { key: 'top3', label: 'Top 3', value: buckets.top3, color: '#10b981' },
    { key: 'page1', label: '4–10', value: buckets.page1, color: '#3b82f6' },
    { key: 'page2', label: '11–20', value: buckets.page2, color: '#eab308' },
    { key: 'deep', label: '21–100', value: buckets.deep, color: '#9ca3af' },
    { key: 'lost', label: 'Lost / Unranked', value: buckets.lost, color: '#ef4444' },
  ];
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildVisibilityTrendFromHistory(
  keywords: Array<{
    history: Array<{ checkedAt: Date; position: number }>;
  }>,
  now: Date
): VisibilityTrendPoint[] | null {
  const dayMap = new Map<string, number[]>();

  for (const keyword of keywords) {
    for (const entry of keyword.history) {
      if (entry.position >= UNRANKED_POSITION) continue;
      const key = entry.checkedAt.toISOString().slice(0, 10);
      const score = Math.max(0, (UNRANKED_POSITION - entry.position) / UNRANKED_POSITION);
      const bucket = dayMap.get(key) ?? [];
      bucket.push(score);
      dayMap.set(key, bucket);
    }
  }

  if (dayMap.size < 2) return null;

  const points: VisibilityTrendPoint[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const scores = dayMap.get(key);
    if (!scores?.length) continue;
    const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    points.push({
      date: formatShortDate(date),
      visibility: Math.round(avg * 100),
    });
  }

  return points.length >= 2 ? points : null;
}

function buildDummyVisibilityTrend(now: Date): VisibilityTrendPoint[] {
  const points: VisibilityTrendPoint[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const wave = Math.sin((14 - offset) / 2.4) * 6;
    const base = 42 + (14 - offset) * 0.8;
    points.push({
      date: formatShortDate(date),
      visibility: Math.round(Math.min(95, Math.max(18, base + wave))),
    });
  }
  return points;
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const workspaceId = await getAuthenticatedWorkspaceId();
  const projectId = await getServerActiveProjectId();
  const now = new Date();

  if (!projectId) {
    return {
      project: null,
      hasKeywords: false,
      hasRankingData: false,
      usesPlaceholderTrend: true,
      kpis: {
        totalKeywords: 0,
        averageRank: null,
        shareOfVoice: 0,
        criticalThreats: 0,
      },
      rankDistribution: buildRankDistribution([]),
      visibilityTrend: buildDummyVisibilityTrend(now),
      topMovers: [],
      topDrops: [],
      activeThreats: [],
    };
  }

  await assertProjectAccess(projectId);
  const clientBrand = await getServerActiveClientBrand();

  const project = await getPrisma().project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      name: true,
      domain: true,
      keywords: {
        where: { isActive: true },
        select: {
          id: true,
          keyword: true,
          location: true,
          language: true,
          searchVolume: true,
          currentRank: true,
          targetUrl: true,
          rankedUrl: true,
          competingPages: true,
          history: {
            orderBy: { checkedAt: 'desc' },
            take: 30,
            select: { checkedAt: true, position: true },
          },
        },
      },
    },
  });

  if (!project) {
    return {
      project: null,
      hasKeywords: false,
      hasRankingData: false,
      usesPlaceholderTrend: true,
      kpis: {
        totalKeywords: 0,
        averageRank: null,
        shareOfVoice: 0,
        criticalThreats: 0,
      },
      rankDistribution: buildRankDistribution([]),
      visibilityTrend: buildDummyVisibilityTrend(now),
      topMovers: [],
      topDrops: [],
      activeThreats: [],
    };
  }

  const keywords = project.keywords;
  const contextKeyword = keywords[0];
  const hasKeywords = keywords.length > 0;
  const hasRankingData = keywords.some(
    keyword =>
      !isUnranked(keyword.currentRank) ||
      keyword.history.some(entry => entry.position < UNRANKED_POSITION)
  );

  const criticalThreats = keywords.filter(hasCriticalThreat).length;
  const { movers, drops } = buildMoverRows(keywords, now);
  const activeThreats = keywords
    .map(keyword => ({
      id: keyword.id,
      keyword: keyword.keyword,
      warnings: getThreatWarnings(keyword),
    }))
    .filter(row => row.warnings.length > 0)
    .slice(0, 5);

  const historyTrendResult = buildVisibilityTrendFromHistory(keywords, now);
  const usesPlaceholderTrend = historyTrendResult == null;
  const visibilityTrend = historyTrendResult ?? buildDummyVisibilityTrend(now);

  return {
    project: {
      id: project.id,
      name: project.name,
      brandLabel: clientBrand?.brandLabel ?? project.name,
      domain: project.domain,
      geoTarget: contextKeyword?.location ?? 'Not set',
      language: contextKeyword?.language ?? 'Not set',
    },
    hasKeywords,
    hasRankingData,
    usesPlaceholderTrend,
    kpis: {
      totalKeywords: keywords.length,
      averageRank: computeAverageRank(keywords),
      shareOfVoice: computeShareOfVoice(keywords),
      criticalThreats,
    },
    rankDistribution: buildRankDistribution(keywords),
    visibilityTrend,
    topMovers: movers,
    topDrops: drops,
    activeThreats,
  };
}

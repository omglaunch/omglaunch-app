import type {
  RankTrackerHistoryEntry,
  RankTrackerKeywordRow,
  TrackingFrequency,
} from '@/lib/rank-tracker/types';
import { UNRANKED_POSITION } from '@/lib/rank-tracker/types';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function keywordSchedule(
  trackingFrequency: TrackingFrequency = 'WEEKLY',
  nextCheckAt: string = new Date().toISOString()
) {
  return { trackingFrequency, nextCheckAt };
}

function buildTrend(
  savedKeywordId: string,
  positions: number[],
  urlFound: string,
  extras: Partial<RankTrackerHistoryEntry> = {}
): RankTrackerHistoryEntry[] {
  return positions.map((position, index) => {
    const previousPosition =
      index === 0 ? position : positions[index - 1] ?? position;
    return {
      id: `${savedKeywordId}-h${index}`,
      savedKeywordId,
      position,
      previousPosition,
      urlFound,
      rankedUrl: urlFound,
      competingPages: null,
      isFeaturedSnippet: false,
      isLocalPack: false,
      serpFeaturesFound: [],
      competitorRankings: { 'competitor.com': position + 3 },
      checkedAt: daysAgo(positions.length - 1 - index),
      ...extras,
    };
  });
}

const DEFAULT_PROJECT_KEYWORDS: Omit<
  RankTrackerKeywordRow,
  'latestHistory' | 'historyTrend'
>[] = [
  {
    id: 'rtk-1',
    projectId: 'default-workspace',
    keyword: 'seo ai analysis tool',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://www.omglaunch.io/seo-analysis',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 8100,
    cpc: 4.85,
    intent: 'Commercial',
    kd: 42,
    currentRank: 3,
    tags: ['core', 'product'],
    isActive: true,
    ...keywordSchedule('DAILY'),
    createdAt: daysAgo(30),
  },
  {
    id: 'rtk-2',
    projectId: 'default-workspace',
    keyword: 'ai content optimization',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/article-studio',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 5400,
    cpc: 3.2,
    intent: 'Informational',
    kd: 38,
    currentRank: 7,
    tags: ['content'],
    isActive: true,
    ...keywordSchedule('EVERY_3_DAYS'),
    createdAt: daysAgo(28),
  },
  {
    id: 'rtk-3',
    projectId: 'default-workspace',
    keyword: 'geo score checker',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/page-audit',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 2900,
    cpc: 2.1,
    intent: 'Transactional',
    kd: 29,
    currentRank: null,
    tags: ['geo'],
    isActive: true,
    ...keywordSchedule('WEEKLY'),
    createdAt: daysAgo(2),
  },
  {
    id: 'rtk-4',
    projectId: 'default-workspace',
    keyword: 'best seo audit software',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/seo-analysis',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 12000,
    cpc: 8.45,
    intent: 'Commercial',
    kd: 61,
    currentRank: null,
    tags: ['competitive'],
    isActive: true,
    ...keywordSchedule('WEEKLY'),
    createdAt: daysAgo(25),
  },
  {
    id: 'rtk-5',
    projectId: 'default-workspace',
    keyword: 'local seo agency kuala lumpur',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/services/local-seo',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 1600,
    cpc: 12.5,
    intent: 'Navigational',
    kd: 35,
    currentRank: 2,
    tags: ['local'],
    isActive: true,
    ...keywordSchedule('DAILY'),
    createdAt: daysAgo(20),
  },
  {
    id: 'rtk-6',
    projectId: 'default-workspace',
    keyword: 'semantic seo analysis',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/semantic-analysis',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 2100,
    cpc: 2.75,
    intent: 'Informational',
    kd: 33,
    currentRank: 4,
    tags: ['semantic'],
    isActive: true,
    ...keywordSchedule('WEEKLY'),
    createdAt: daysAgo(18),
  },
  {
    id: 'rtk-7',
    projectId: 'default-workspace',
    keyword: 'json-ld validator seo',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/tools/json-ld',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 1700,
    cpc: 1.4,
    intent: 'Informational',
    kd: 22,
    currentRank: 6,
    tags: ['technical'],
    isActive: false,
    ...keywordSchedule('EVERY_3_DAYS'),
    createdAt: daysAgo(40),
  },
  {
    id: 'rtk-8',
    projectId: 'default-workspace',
    keyword: 'content readability score',
    location: 'Malaysia',
    language: 'English',
    targetUrl: 'https://omglaunch.io/page-audit',
    rankedUrl: null,
    competingPages: null,
    searchVolume: 9400,
    cpc: 1.95,
    intent: 'Informational',
    kd: 27,
    currentRank: 1,
    tags: ['content'],
    isActive: true,
    ...keywordSchedule('WEEKLY'),
    createdAt: daysAgo(15),
  },
];

function buildDefaultProjectRows(): RankTrackerKeywordRow[] {
  const historyByKeyword: Record<string, RankTrackerHistoryEntry[]> = {
    'rtk-1': buildTrend(
      'rtk-1',
      [8, 7, 6, 5, 4, 4, 3],
      'https://www.omglaunch.io/seo-analysis',
      {
        isFeaturedSnippet: true,
        serpFeaturesFound: ['Featured Snippet', 'People Also Ask'],
        competitorRankings: { 'semrush.com': 2, 'ahrefs.com': 6 },
      }
    ),
    'rtk-2': buildTrend(
      'rtk-2',
      [4, 5, 5, 6, 6, 5, 7],
      'https://omglaunch.io/article-studio',
      { serpFeaturesFound: ['Video'] }
    ),
    'rtk-3': [],
    'rtk-4': buildTrend(
      'rtk-4',
      [101, 101, 101, 101, 101, 101, UNRANKED_POSITION],
      '',
      { competitorRankings: { 'semrush.com': 1, 'moz.com': 4 } }
    ),
    'rtk-5': buildTrend(
      'rtk-5',
      [5, 4, 3, 3, 2, 2, 2],
      'https://omglaunch.io/services/local-seo',
      {
        isLocalPack: true,
        serpFeaturesFound: ['Local Pack', 'Maps'],
        competitorRankings: { 'localrival.my': 1 },
      }
    ),
    'rtk-6': buildTrend(
      'rtk-6',
      [6, 6, 5, 5, 4, 4, 4],
      'https://omglaunch.io/blog/semantic-seo-guide/',
      { serpFeaturesFound: ['People Also Ask'] }
    ),
    'rtk-7': buildTrend(
      'rtk-7',
      [6, 6, 6, 6, 6, 6, 6],
      'https://omglaunch.io/tools/json-ld'
    ),
    'rtk-8': buildTrend(
      'rtk-8',
      [3, 2, 2, 1, 1, 1, 1],
      'https://omglaunch.io/page-audit',
      { competitorRankings: { 'surferseo.com': 5 } }
    ),
  };

  return DEFAULT_PROJECT_KEYWORDS.map(keyword => {
    const historyTrend = historyByKeyword[keyword.id] ?? [];
    const latestHistory =
      historyTrend.length > 0 ? historyTrend[historyTrend.length - 1]! : null;
    return { ...keyword, latestHistory, historyTrend };
  });
}

const MOCK_BY_PROJECT: Record<string, RankTrackerKeywordRow[]> = {
  'default-workspace': buildDefaultProjectRows(),
};

export function getMockRankTrackerRows(
  projectId: string
): RankTrackerKeywordRow[] {
  return structuredClone(MOCK_BY_PROJECT[projectId] ?? []);
}

export function getAllMockTags(projectId: string): string[] {
  const tags = new Set<string>();
  getMockRankTrackerRows(projectId).forEach(row => {
    row.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

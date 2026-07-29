export type KeywordIntent =
  | 'Informational'
  | 'Navigational'
  | 'Commercial'
  | 'Transactional';

export type TrackingFrequency = 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY';

export const DEFAULT_TRACKING_FREQUENCY: TrackingFrequency = 'WEEKLY';

export const TRACKING_FREQUENCY_OPTIONS: {
  value: TrackingFrequency;
  label: string;
}[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'EVERY_3_DAYS', label: 'Every 3 Days' },
  { value: 'WEEKLY', label: 'Weekly' },
];

export type CompetingPage = {
  url: string;
  rank: number;
};

/** Unified saved keyword row as displayed in Rank Tracker. */
export type RankTrackerKeywordRow = {
  id: string;
  projectId: string;
  keyword: string;
  location: string;
  language: string;
  targetUrl: string | null;
  rankedUrl: string | null;
  competingPages: CompetingPage[] | null;
  searchVolume: number | null;
  cpc: number | null;
  intent: KeywordIntent;
  kd: number | null;
  currentRank: number | null;
  tags: string[];
  isActive: boolean;
  trackingFrequency: TrackingFrequency;
  nextCheckAt: string | null;
  createdAt: string;
  latestHistory: RankTrackerHistoryEntry | null;
  historyTrend: RankTrackerHistoryEntry[];
};

export type RankTrackerHistoryEntry = {
  id: string;
  savedKeywordId: string;
  position: number;
  previousPosition: number;
  urlFound: string;
  rankedUrl: string;
  competingPages: CompetingPage[] | null;
  isFeaturedSnippet: boolean;
  isLocalPack: boolean;
  serpFeaturesFound: string[];
  competitorRankings: Record<string, number>;
  checkedAt: string;
};

export type RankTrackerSortField =
  | 'keyword'
  | 'searchVolume'
  | 'cpc'
  | 'position';

export type SortDirection = 'asc' | 'desc';

export const INTENT_BADGE: Record<
  KeywordIntent,
  { label: string; className: string }
> = {
  Transactional: {
    label: 'T',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
  },
  Informational: {
    label: 'I',
    className:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
  },
  Commercial: {
    label: 'C',
    className:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
  },
  Navigational: {
    label: 'N',
    className:
      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50',
  },
};

export const UNRANKED_POSITION = 101;

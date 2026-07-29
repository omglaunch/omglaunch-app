import type { Prisma } from '@prisma/client';
import { getResearchLocationLabel } from '@/app/(dashboard)/research/research-locations';
import {
  requireAccessibleProjectId,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';
import { requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { getProjectTrackingContext } from '@/lib/projects/tracking-context';
import { prisma } from '@/lib/prisma';
import { languageLabelFromCode } from '@/lib/rank-tracker/defaults';
import { parseCompetingPagesJson } from '@/lib/rank-tracker/cannibalization';
import type {
  KeywordIntent,
  RankTrackerHistoryEntry,
  RankTrackerKeywordRow,
  TrackingFrequency,
} from '@/lib/rank-tracker/types';

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function parseRecord(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number') {
      record[key] = entry;
    }
  }
  return record;
}

function parseTrackingFrequency(value: string): TrackingFrequency {
  if (value === 'DAILY' || value === 'EVERY_3_DAYS' || value === 'WEEKLY') {
    return value;
  }
  return 'WEEKLY';
}

function parseKeywordIntent(value: string | null | undefined): KeywordIntent {
  if (!value?.trim()) {
    return 'Informational';
  }

  const normalized = value.trim();
  if (
    normalized === 'Informational' ||
    normalized === 'Navigational' ||
    normalized === 'Commercial' ||
    normalized === 'Transactional'
  ) {
    return normalized;
  }
  return 'Informational';
}

function serializeHistoryEntry(record: {
  id: string;
  savedKeywordId: string;
  position: number;
  previousPosition: number;
  urlFound: string;
  rankedUrl: string | null;
  competingPages: string | null;
  isFeaturedSnippet: boolean;
  isLocalPack: boolean;
  serpFeaturesFound: Prisma.JsonValue;
  competitorRankings: Prisma.JsonValue;
  checkedAt: Date;
}): RankTrackerHistoryEntry {
  return {
    id: record.id,
    savedKeywordId: record.savedKeywordId,
    position: record.position,
    previousPosition: record.previousPosition,
    urlFound: record.rankedUrl ?? record.urlFound,
    rankedUrl: record.rankedUrl ?? record.urlFound,
    competingPages: parseCompetingPagesJson(record.competingPages),
    isFeaturedSnippet: record.isFeaturedSnippet,
    isLocalPack: record.isLocalPack,
    serpFeaturesFound: parseStringArray(record.serpFeaturesFound),
    competitorRankings: parseRecord(record.competitorRankings),
    checkedAt: record.checkedAt.toISOString(),
  };
}

function synthesizeHistoryFromSnapshot(record: {
  id: string;
  currentRank: number | null;
  rankedUrl: string | null;
  competingPages: string | null;
  lastTrackedAt: Date | null;
  createdAt: Date;
}): RankTrackerHistoryEntry | null {
  if (record.currentRank == null) return null;

  return {
    id: `snapshot-${record.id}`,
    savedKeywordId: record.id,
    position: record.currentRank,
    previousPosition: record.currentRank,
    urlFound: record.rankedUrl ?? '',
    rankedUrl: record.rankedUrl ?? '',
    competingPages: parseCompetingPagesJson(record.competingPages),
    isFeaturedSnippet: false,
    isLocalPack: false,
    serpFeaturesFound: [],
    competitorRankings: {},
    checkedAt: (record.lastTrackedAt ?? record.createdAt).toISOString(),
  };
}

function serializeKeywordRow(
  record: {
    id: string;
    projectId: string;
    keyword: string;
    location: string;
    language: string;
    targetUrl: string | null;
    rankedUrl: string | null;
    competingPages: string | null;
    searchVolume: number | null;
    cpc: number | null;
    intent: string | null;
    kd: number | null;
    currentRank: number | null;
    lastTrackedAt: Date | null;
    tags: Prisma.JsonValue;
    isActive: boolean;
    trackingFrequency: string;
    nextCheckAt: Date | null;
    createdAt: Date;
    history: Array<{
      id: string;
      savedKeywordId: string;
      position: number;
      previousPosition: number;
      urlFound: string;
      rankedUrl: string | null;
      competingPages: string | null;
      isFeaturedSnippet: boolean;
      isLocalPack: boolean;
      serpFeaturesFound: Prisma.JsonValue;
      competitorRankings: Prisma.JsonValue;
      checkedAt: Date;
    }>;
  }
): RankTrackerKeywordRow {
  const historyTrend = record.history.map(serializeHistoryEntry);
  const latestHistory =
    historyTrend[0] ?? synthesizeHistoryFromSnapshot(record);

  return {
    id: record.id,
    projectId: record.projectId,
    keyword: record.keyword,
    location: record.location,
    language: record.language,
    targetUrl: record.targetUrl,
    rankedUrl: record.rankedUrl,
    competingPages: parseCompetingPagesJson(record.competingPages),
    searchVolume: record.searchVolume,
    cpc: record.cpc,
    intent: parseKeywordIntent(record.intent),
    kd: record.kd,
    currentRank: record.currentRank,
    tags: parseStringArray(record.tags),
    isActive: record.isActive,
    trackingFrequency: parseTrackingFrequency(record.trackingFrequency),
    nextCheckAt: record.nextCheckAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    latestHistory,
    historyTrend,
  };
}

/** Fetch all saved keywords for a project, including rank history snapshots. */
export async function listRankTrackerKeywordRows(
  projectId: string,
  workspaceId: string
): Promise<RankTrackerKeywordRow[]> {
  const keywords = await prisma.savedKeyword.findMany({
    where: { projectId, workspaceId },
    include: {
      history: {
        orderBy: { checkedAt: 'desc' },
        take: 7,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return keywords.map(serializeKeywordRow);
}

export async function injectTrackedKeywords(
  projectId: string,
  keywords: string[],
  options: {
    targetUrl?: string | null;
    tags?: string[];
    trackingFrequency: TrackingFrequency;
  }
): Promise<{ inserted: number; skipped: number }> {
  const workspaceId = await requireWorkspaceId();
  await requireAccessibleProjectWriteId(projectId);

  const context = await getProjectTrackingContext(projectId, workspaceId);
  if (!context) {
    throw new Error('Project not found or access denied.');
  }

  const location = getResearchLocationLabel(context.locationCode);
  const language = languageLabelFromCode(context.languageCode);
  const searchEngine =
    context.searchEngine === 'google_maps' ? 'google_maps' : 'google';
  const now = new Date();
  const tags = options.tags ?? [];

  let inserted = 0;
  let skipped = 0;

  for (const rawKeyword of keywords) {
    const keyword = rawKeyword.trim();
    if (!keyword) continue;

    const existing = await prisma.savedKeyword.findFirst({
      where: {
        workspaceId,
        projectId,
        keyword,
        location,
        language,
        searchEngine,
        device: context.deviceType,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.savedKeyword.create({
      data: {
        workspaceId,
        projectId,
        keyword,
        location,
        locationCode: context.locationCode,
        language,
        languageCode: context.languageCode,
        searchEngine,
        device: context.deviceType,
        targetUrl: options.targetUrl?.trim() || null,
        tags,
        isActive: true,
        trackingFrequency: options.trackingFrequency,
        nextCheckAt: now,
      },
    });

    inserted += 1;
  }

  return { inserted, skipped };
}

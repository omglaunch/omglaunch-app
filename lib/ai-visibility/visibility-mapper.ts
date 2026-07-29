import type { VisibilityPrompt, Prisma } from '@prisma/client';
import type {
  CompetitorThreat,
  GoogleAioCitation,
  LlmCitation,
  PerplexityCitation,
  RowSyncState,
  SyncDotStatus,
  VisibilityRow,
} from '@/lib/ai-visibility/types';

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseSyncDots(value: unknown): SyncDotStatus[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SyncDotStatus =>
      item === 'cited' ||
      item === 'omitted' ||
      item === 'failed' ||
      item === 'pending' ||
      item === 'na'
  );
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function toDate(value: string): Date {
  return new Date(value);
}

export function visibilityPromptToRow(record: VisibilityPrompt): VisibilityRow {
  return {
    promptId: record.id,
    projectId: record.projectId,
    prompt: record.prompt,
    promptCluster: record.promptCluster,
    aiSearchVol: record.aiSearchVol,
    aiSearchVolConfirmed: record.aiSearchVolConfirmed,
    organicRank: record.organicRank,
    geoTarget: record.geoTarget,
    geoLocationId: record.geoLocationId,
    geoTimezone: record.geoTimezone,
    userTargetUrl: record.userTargetUrl,
    brandAliases: parseStringArray(record.brandAliases),
    persistenceTrend: parseSyncDots(record.persistenceTrend),
    lastSyncedAt: record.lastSyncedAt.toISOString(),
    lastActionAt: record.lastActionAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    nextCronRun: toIso(record.nextCronRun),
    googleAio: record.googleAio as GoogleAioCitation,
    perplexity: record.perplexity as PerplexityCitation,
    chatgpt: record.chatgpt as LlmCitation,
    claude: record.claude as LlmCitation,
    competitorThreat: record.competitorThreat as CompetitorThreat,
    rowSyncState: record.rowSyncState as RowSyncState,
    deepScanEnabled: record.deepScanEnabled,
    suspended: record.suspended,
  };
}

export function visibilityRowToUpsertInput(
  row: VisibilityRow,
  sortOrder: number
): Prisma.VisibilityPromptCreateInput {
  if (!row.projectId?.trim()) {
    throw new Error('projectId is required to persist a visibility row.');
  }

  return {
    id: row.promptId,
    project: { connect: { id: row.projectId } },
    prompt: row.prompt,
    promptCluster: row.promptCluster,
    aiSearchVol: row.aiSearchVol,
    aiSearchVolConfirmed: row.aiSearchVolConfirmed,
    organicRank: row.organicRank,
    geoTarget: row.geoTarget,
    geoLocationId: row.geoLocationId ?? null,
    geoTimezone: row.geoTimezone,
    userTargetUrl: row.userTargetUrl,
    brandAliases: row.brandAliases,
    persistenceTrend: row.persistenceTrend,
    lastSyncedAt: toDate(row.lastSyncedAt),
    lastActionAt: toDate(row.lastActionAt),
    updatedAt: toDate(row.updatedAt),
    nextCronRun: row.nextCronRun ? toDate(row.nextCronRun) : null,
    googleAio: row.googleAio as Prisma.InputJsonValue,
    perplexity: row.perplexity as Prisma.InputJsonValue,
    chatgpt: row.chatgpt as Prisma.InputJsonValue,
    claude: row.claude as Prisma.InputJsonValue,
    competitorThreat: row.competitorThreat as Prisma.InputJsonValue,
    rowSyncState: row.rowSyncState,
    deepScanEnabled: row.deepScanEnabled,
    suspended: row.suspended,
    sortOrder,
  };
}

export function visibilityRowToUpdateInput(
  row: VisibilityRow
): Prisma.VisibilityPromptUpdateInput {
  return {
    prompt: row.prompt,
    promptCluster: row.promptCluster,
    aiSearchVol: row.aiSearchVol,
    aiSearchVolConfirmed: row.aiSearchVolConfirmed,
    organicRank: row.organicRank,
    geoTarget: row.geoTarget,
    geoLocationId: row.geoLocationId ?? null,
    geoTimezone: row.geoTimezone,
    userTargetUrl: row.userTargetUrl,
    brandAliases: row.brandAliases,
    persistenceTrend: row.persistenceTrend,
    lastSyncedAt: toDate(row.lastSyncedAt),
    lastActionAt: toDate(row.lastActionAt),
    updatedAt: toDate(row.updatedAt),
    nextCronRun: row.nextCronRun ? toDate(row.nextCronRun) : null,
    googleAio: row.googleAio as Prisma.InputJsonValue,
    perplexity: row.perplexity as Prisma.InputJsonValue,
    chatgpt: row.chatgpt as Prisma.InputJsonValue,
    claude: row.claude as Prisma.InputJsonValue,
    competitorThreat: row.competitorThreat as Prisma.InputJsonValue,
    rowSyncState: row.rowSyncState,
    deepScanEnabled: row.deepScanEnabled,
    suspended: row.suspended,
  };
}

import type { Prisma } from '@prisma/client';
import { LEGACY_DEFAULT_SCOPE_ID } from '@/lib/projects/constants';
import { requireProjectId } from '@/lib/projects/workspace-scope';
import { getHistoryDelegate } from '@/lib/tool-history/registry';
import { extractKeywordAuditMetadata } from '@/lib/types/keyword-audit';
import type {
  MigrateToolHistoryInput,
  SaveToolHistoryInput,
  ToolHistoryEntry,
  ToolHistorySummary,
  ToolSlug,
  UpdateToolHistoryInput,
} from '@/lib/tool-history/types';
import { prisma } from '@/lib/prisma';

type HistoryRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
  identifier: string;
  resultData: Prisma.JsonValue;
  country?: string | null;
  city?: string | null;
  language?: string | null;
  device?: string | null;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  topCompetitors?: Prisma.JsonValue | null;
};

function serializeEntry(record: HistoryRecord): ToolHistoryEntry {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    workspaceId: record.workspaceId,
    identifier: record.identifier,
    resultData: record.resultData,
  };
}

function serializeSummary(record: HistoryRecord): ToolHistorySummary {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    identifier: record.identifier,
    country: record.country,
    city: record.city,
    language: record.language,
    device: record.device,
    searchVolume: record.searchVolume,
    keywordDifficulty: record.keywordDifficulty,
  };
}

function buildKeywordAuditHistoryData(
  workspaceId: string,
  input: SaveToolHistoryInput
): Record<string, unknown> {
  const metadata = extractKeywordAuditMetadata(input.resultData);

  return {
    workspaceId,
    identifier: input.identifier.trim(),
    resultData: input.resultData as Prisma.InputJsonValue,
    country: metadata.country ?? null,
    city: metadata.city ?? null,
    language: metadata.language ?? null,
    device: metadata.device ?? null,
    searchVolume: metadata.searchVolume ?? null,
    keywordDifficulty: metadata.keywordDifficulty ?? null,
    topCompetitors:
      metadata.topCompetitors && metadata.topCompetitors.length > 0
        ? metadata.topCompetitors
        : null,
  };
}

function buildKeywordAuditHistoryUpdateData(
  input: UpdateToolHistoryInput,
  existing: HistoryRecord
): Record<string, unknown> {
  const metadata = extractKeywordAuditMetadata(input.resultData);

  return {
    ...(input.identifier !== undefined ? { identifier: input.identifier.trim() } : {}),
    resultData: input.resultData as Prisma.InputJsonValue,
    country: metadata.country ?? existing.country ?? null,
    city: metadata.city ?? existing.city ?? null,
    language: metadata.language ?? existing.language ?? null,
    device: metadata.device ?? existing.device ?? null,
    searchVolume: metadata.searchVolume ?? existing.searchVolume ?? null,
    keywordDifficulty: metadata.keywordDifficulty ?? existing.keywordDifficulty ?? null,
    topCompetitors:
      metadata.topCompetitors && metadata.topCompetitors.length > 0
        ? metadata.topCompetitors
        : existing.topCompetitors ?? null,
  };
}

export async function listToolHistory(
  tool: ToolSlug,
  options?: { workspaceId?: string; limit?: number }
): Promise<ToolHistorySummary[]> {
  const workspaceId = options?.workspaceId?.trim();
  if (!workspaceId) {
    return [];
  }

  const limit = options?.limit ?? 50;

  await migrateLegacyRecordsIfNeeded(tool, workspaceId);

  const delegate = getHistoryDelegate(prisma, tool);
  const selectFields =
    tool === 'keyword-audit'
      ? {
          id: true,
          createdAt: true,
          updatedAt: true,
          identifier: true,
          country: true,
          city: true,
          language: true,
          device: true,
          searchVolume: true,
          keywordDifficulty: true,
        }
      : {
          id: true,
          createdAt: true,
          updatedAt: true,
          identifier: true,
        };

  const records = (await delegate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: selectFields,
  })) as HistoryRecord[];

  return records.map(serializeSummary);
}

export async function getToolHistoryEntry(
  tool: ToolSlug,
  id: string,
  workspaceId?: string
): Promise<ToolHistoryEntry | null> {
  const scopedWorkspaceId = workspaceId?.trim();
  if (!scopedWorkspaceId) {
    return null;
  }

  const delegate = getHistoryDelegate(prisma, tool);
  const record = (await delegate.findFirst({
    where: { id, workspaceId: scopedWorkspaceId },
  })) as HistoryRecord | null;

  return record ? serializeEntry(record) : null;
}

export async function getLatestToolHistoryByIdentifier(
  tool: ToolSlug,
  identifier: string,
  workspaceId?: string
): Promise<ToolHistoryEntry | null> {
  const scopedWorkspaceId = workspaceId?.trim();
  if (!scopedWorkspaceId) {
    return null;
  }

  const delegate = getHistoryDelegate(prisma, tool);
  const record = (await delegate.findFirst({
    where: { workspaceId: scopedWorkspaceId, identifier },
    orderBy: { createdAt: 'desc' },
  })) as HistoryRecord | null;

  return record ? serializeEntry(record) : null;
}

export async function saveToolHistory(
  tool: ToolSlug,
  input: SaveToolHistoryInput
): Promise<ToolHistoryEntry> {
  const workspaceId = requireProjectId(input.workspaceId);

  if (input.id?.trim()) {
    return updateToolHistory(tool, input.id.trim(), {
      identifier: input.identifier,
      resultData: input.resultData,
      workspaceId,
    });
  }

  const delegate = getHistoryDelegate(prisma, tool);

  const record = (await delegate.create({
    data:
      tool === 'keyword-audit'
        ? buildKeywordAuditHistoryData(workspaceId, input)
        : {
            workspaceId,
            identifier: input.identifier.trim(),
            resultData: input.resultData as Prisma.InputJsonValue,
          },
  })) as HistoryRecord;

  return serializeEntry(record);
}

export async function updateToolHistory(
  tool: ToolSlug,
  id: string,
  input: UpdateToolHistoryInput
): Promise<ToolHistoryEntry> {
  const workspaceId = requireProjectId(input.workspaceId);
  const delegate = getHistoryDelegate(prisma, tool);

  const existing = (await delegate.findFirst({
    where: { id, workspaceId },
  })) as HistoryRecord | null;

  if (!existing) {
    throw new Error('History entry not found');
  }

  const identifier =
    input.identifier !== undefined ? input.identifier.trim() : existing.identifier;

  if (input.identifier !== undefined && !identifier) {
    throw new Error('identifier cannot be empty');
  }

  const record = (await delegate.update({
    where: { id },
    data:
      tool === 'keyword-audit'
        ? buildKeywordAuditHistoryUpdateData(
            {
              identifier: input.identifier !== undefined ? identifier : undefined,
              resultData: input.resultData,
              workspaceId,
            },
            existing
          )
        : {
            ...(input.identifier !== undefined ? { identifier } : {}),
            resultData: input.resultData as Prisma.InputJsonValue,
          },
  })) as HistoryRecord;

  return serializeEntry(record);
}

export async function deleteToolHistoryEntry(
  tool: ToolSlug,
  id: string,
  workspaceId?: string
): Promise<boolean> {
  const scopedWorkspaceId = workspaceId?.trim();
  if (!scopedWorkspaceId) {
    return false;
  }

  const delegate = getHistoryDelegate(prisma, tool);

  const existing = (await delegate.findFirst({
    where: { id, workspaceId: scopedWorkspaceId },
    select: { id: true },
  })) as { id: string } | null;

  if (!existing) {
    return false;
  }

  await delegate.delete({ where: { id } });
  return true;
}

export async function migrateToolHistoryEntries(
  tool: ToolSlug,
  input: MigrateToolHistoryInput
): Promise<{ imported: number }> {
  const workspaceId = requireProjectId(input.workspaceId);
  const delegate = getHistoryDelegate(prisma, tool);

  if (input.entries.length === 0) {
    return { imported: 0 };
  }

  await delegate.createMany({
    data: input.entries.map(entry => ({
      workspaceId,
      identifier: entry.identifier.trim(),
      resultData: entry.resultData as Prisma.InputJsonValue,
      ...(entry.createdAt ? { createdAt: new Date(entry.createdAt) } : {}),
    })),
  });

  return { imported: input.entries.length };
}

async function migrateLegacyRecordsIfNeeded(
  tool: ToolSlug,
  workspaceId: string
): Promise<void> {
  // Legacy data belongs only on the default "Main Project" campaign — never clone into others.
  if (workspaceId !== LEGACY_DEFAULT_SCOPE_ID) {
    return;
  }

  const delegate = getHistoryDelegate(prisma, tool);
  const existingCount = await delegate.count({ where: { workspaceId } });

  if (existingCount > 0) {
    return;
  }

  if (tool === 'page-audit') {
    await migrateLegacyPageAudits(workspaceId);
    return;
  }

  if (tool === 'hub-spoke') {
    await migrateLegacyHubSpokeMaps(workspaceId);
    return;
  }

  if (tool === 'article-studio') {
    await migrateLegacyArticleStudio(workspaceId);
  }
}

async function migrateLegacyPageAudits(workspaceId: string): Promise<void> {
  const audits = await prisma.pageAudit.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (audits.length === 0) {
    return;
  }

  await prisma.pageAuditHistory.createMany({
    data: audits.map(audit => ({
      workspaceId,
      identifier: audit.url,
      createdAt: audit.createdAt,
      resultData: {
        legacyAuditId: audit.id,
        url: audit.url,
        targetKeyword: audit.targetKeyword,
        geoScore: audit.geoScore,
        auditData: audit.auditData,
        projectId: workspaceId,
      },
    })),
  });
}

async function migrateLegacyHubSpokeMaps(workspaceId: string): Promise<void> {
  const maps = await prisma.hubSpokeMap.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (maps.length === 0) {
    return;
  }

  await prisma.hubSpokeHistory.createMany({
    data: maps.map(map => ({
      workspaceId,
      identifier: map.seedKeyword,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      resultData: {
        legacyMapId: map.id,
        seedKeyword: map.seedKeyword,
        location: map.location,
        mapData: map.mapData,
        projectId: workspaceId,
      },
    })),
  });
}

async function migrateLegacyArticleStudio(workspaceId: string): Promise<void> {
  const briefs = await prisma.contentBrief.findMany({
    include: {
      articles: {
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (briefs.length === 0) {
    return;
  }

  await prisma.articleStudioHistory.createMany({
    data: briefs.map(brief => ({
      workspaceId,
      identifier: brief.targetKeyword,
      createdAt: brief.createdAt,
      resultData: {
        legacyBriefId: brief.id,
        targetKeyword: brief.targetKeyword,
        targetUrl: brief.targetUrl,
        content: brief.content,
        projectId: workspaceId,
        articles: brief.articles.map(article => ({
          id: article.id,
          briefId: article.briefId,
          title: article.title,
          content: article.content,
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
        })),
      },
    })),
  });
}

import { getPrisma } from '@/lib/prisma';
import type { ContentBriefRecord } from '@/lib/content-pipeline-data';
import { buildSiloBriefContent } from '@/lib/silo-builder/brief-content';
import { linkSiloNodeArticleStudioHistory } from '@/lib/silo-builder/status-sync';

export type SiloBriefInput = {
  siloNodeId: string;
  siloProjectId: string;
  siloProjectTitle: string;
  targetKeyword: string;
  title: string;
  intent?: string | null;
};

function getSiloHistoryMetadata(resultData: unknown): {
  siloNodeId?: string;
  legacyBriefId?: number;
} | null {
  if (!resultData || typeof resultData !== 'object') {
    return null;
  }

  const record = resultData as Record<string, unknown>;
  return {
    siloNodeId: typeof record.siloNodeId === 'string' ? record.siloNodeId : undefined,
    legacyBriefId:
      typeof record.legacyBriefId === 'number'
        ? record.legacyBriefId
        : typeof record.id === 'number'
          ? record.id
          : undefined,
  };
}

function toContentBriefRecord(brief: {
  id: number;
  targetKeyword: string;
  targetUrl: string;
  content: string;
  createdAt: Date;
  articles: Array<{
    id: number;
    briefId: number;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): ContentBriefRecord {
  return {
    id: brief.id,
    targetKeyword: brief.targetKeyword,
    targetUrl: brief.targetUrl,
    content: brief.content,
    createdAt: brief.createdAt.toISOString(),
    articles: brief.articles.map(article => ({
      id: article.id,
      briefId: article.briefId,
      title: article.title,
      content: article.content,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    })),
  };
}

export async function findExistingSiloBriefRecord(
  workspaceId: string,
  siloNodeId: string
): Promise<ContentBriefRecord | null> {
  const prisma = getPrisma();
  const entries = await prisma.articleStudioHistory.findMany({
    where: { workspaceId },
    select: { resultData: true },
    orderBy: { updatedAt: 'desc' },
  });

  for (const entry of entries) {
    const metadata = getSiloHistoryMetadata(entry.resultData);
    if (metadata?.siloNodeId !== siloNodeId || !metadata.legacyBriefId) {
      continue;
    }

    const brief = await prisma.contentBrief.findUnique({
      where: { id: metadata.legacyBriefId },
      include: {
        articles: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (brief) {
      return toContentBriefRecord(brief);
    }
  }

  return null;
}

export async function createSiloBuilderBriefRecord(
  workspaceId: string,
  input: SiloBriefInput
): Promise<ContentBriefRecord> {
  const prisma = getPrisma();
  const targetKeyword = input.targetKeyword.trim();
  const title = input.title.trim();

  if (!targetKeyword) {
    throw new Error('Target keyword is required.');
  }

  const existing = await findExistingSiloBriefRecord(workspaceId, input.siloNodeId);
  if (existing) {
    const prisma = getPrisma();
    const entries = await prisma.articleStudioHistory.findMany({
      where: { workspaceId },
      select: { id: true, resultData: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    for (const entry of entries) {
      const metadata = getSiloHistoryMetadata(entry.resultData);
      if (metadata?.siloNodeId === input.siloNodeId) {
        await linkSiloNodeArticleStudioHistory(input.siloNodeId, entry.id);
        break;
      }
    }

    return existing;
  }

  const brief = await prisma.contentBrief.create({
    data: {
      targetKeyword,
      targetUrl: '',
      content: buildSiloBriefContent({
        title: title || targetKeyword,
        targetKeyword,
        intent: input.intent?.trim() || null,
        projectTitle: input.siloProjectTitle.trim() || 'Silo Builder',
        variant: 'draft',
      }),
    },
    include: {
      articles: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  const record = toContentBriefRecord(brief);

  const history = await prisma.articleStudioHistory.create({
    data: {
      workspaceId,
      identifier: record.targetKeyword,
      resultData: {
        ...record,
        legacyBriefId: record.id,
        projectId: workspaceId,
        siloNodeId: input.siloNodeId,
        siloProjectId: input.siloProjectId,
        siloSource: 'silo-builder',
        state: 'brief',
      },
    },
  });

  await linkSiloNodeArticleStudioHistory(input.siloNodeId, history.id);

  return record;
}

export async function createSiloBuilderBriefRecords(
  workspaceId: string,
  nodes: SiloBriefInput[]
): Promise<ContentBriefRecord[]> {
  const records: ContentBriefRecord[] = [];

  for (const node of nodes) {
    const record = await createSiloBuilderBriefRecord(workspaceId, node);
    records.push(record);
  }

  return records;
}

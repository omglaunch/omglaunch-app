import { requireWorkspaceId } from '@/lib/projects/workspace-scope';
import { buildBriefLinkedHistoryPayload } from '@/lib/tool-history/article-studio-persistence';
import { getPrisma } from '@/lib/prisma';
import type { ArticleRecord } from '@/lib/content-pipeline-data';
import { buildSiloBriefContent } from '@/lib/silo-builder/brief-content';
import { htmlToMarkdown } from '@/lib/silo-builder/html-to-markdown';
import { linkSiloNodeArticleStudioHistory } from '@/lib/silo-builder/status-sync';

type SiloArticleStudioSyncInput = {
  articleStudioProjectId: string;
  nodeId: string;
  projectId: string;
  projectTitle: string;
  title: string;
  targetKeyword: string;
  intent: string | null;
  htmlContent: string;
};

type SiloArticleStudioLink = {
  briefId: number;
  articleId: number;
  historyId: string;
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

function toArticleRecord(article: {
  id: number;
  briefId: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): ArticleRecord {
  return {
    id: article.id,
    briefId: article.briefId,
    title: article.title,
    content: article.content,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

async function findExistingSiloArticleStudioLink(
  articleStudioProjectId: string,
  nodeId: string
): Promise<SiloArticleStudioLink | null> {
  const prisma = getPrisma();
  const entries = await prisma.articleStudioHistory.findMany({
    where: { workspaceId: articleStudioProjectId },
    select: { id: true, resultData: true },
    orderBy: { updatedAt: 'desc' },
  });

  for (const entry of entries) {
    const metadata = getSiloHistoryMetadata(entry.resultData);
    if (metadata?.siloNodeId !== nodeId || !metadata.legacyBriefId) {
      continue;
    }

    const article = await prisma.article.findUnique({
      where: { briefId: metadata.legacyBriefId },
      select: { id: true },
    });

    if (!article) {
      continue;
    }

    return {
      briefId: metadata.legacyBriefId,
      articleId: article.id,
      historyId: entry.id,
    };
  }

  return null;
}

export async function syncSiloNodeToArticleStudio(
  input: SiloArticleStudioSyncInput
): Promise<SiloArticleStudioLink> {
  const prisma = getPrisma();
  const articleStudioProjectId = requireWorkspaceId(
    input.articleStudioProjectId,
    'articleStudioProjectId'
  );
  const targetKeyword = input.targetKeyword.trim() || input.title.trim();
  const title = input.title.trim();
  const markdownContent = htmlToMarkdown(input.htmlContent, title);
  const existing = await findExistingSiloArticleStudioLink(
    articleStudioProjectId,
    input.nodeId
  );

  if (existing) {
    const brief = await prisma.contentBrief.update({
      where: { id: existing.briefId },
      data: {
        targetKeyword,
        content: buildSiloBriefContent({
          title,
          targetKeyword,
          intent: input.intent,
          projectTitle: input.projectTitle,
          variant: 'synced',
        }),
      },
    });

    const article = await prisma.article.update({
      where: { id: existing.articleId },
      data: {
        title,
        content: markdownContent,
      },
    });

    const resultData = {
      ...buildBriefLinkedHistoryPayload(brief, toArticleRecord(article), markdownContent, {
        seoTitle: title,
        metaDescription: null,
      }),
      siloNodeId: input.nodeId,
      siloProjectId: input.projectId,
      siloSource: 'silo-builder',
      projectId: articleStudioProjectId,
      state: 'generated',
    };

    await prisma.articleStudioHistory.update({
      where: { id: existing.historyId },
      data: {
        identifier: targetKeyword,
        resultData,
      },
    });

    await linkSiloNodeArticleStudioHistory(input.nodeId, existing.historyId);

    return existing;
  }

  const brief = await prisma.contentBrief.create({
    data: {
      targetKeyword,
      targetUrl: '',
      content: buildSiloBriefContent({
        title,
        targetKeyword,
        intent: input.intent,
        projectTitle: input.projectTitle,
        variant: 'synced',
      }),
    },
  });

  const article = await prisma.article.create({
    data: {
      briefId: brief.id,
      title,
      content: markdownContent,
    },
  });

  const resultData = {
    ...buildBriefLinkedHistoryPayload(brief, toArticleRecord(article), markdownContent, {
      seoTitle: title,
      metaDescription: null,
    }),
    siloNodeId: input.nodeId,
    siloProjectId: input.projectId,
    siloSource: 'silo-builder',
    projectId: articleStudioProjectId,
    state: 'generated',
  };

  const history = await prisma.articleStudioHistory.create({
    data: {
      workspaceId: articleStudioProjectId,
      identifier: targetKeyword,
      resultData,
    },
  });

  await linkSiloNodeArticleStudioHistory(input.nodeId, history.id);

  return {
    briefId: brief.id,
    articleId: article.id,
    historyId: history.id,
  };
}

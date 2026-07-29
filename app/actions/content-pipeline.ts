'use server';

import { requireWorkspaceId } from '@/lib/projects/workspace-scope';
import { parseArticleStudioHistoryPayload } from '@/lib/tool-history/article-studio-persistence';
import { prisma } from '@/lib/prisma';
import type { ArticleStudioData, ContentBriefRecord } from '@/lib/content-pipeline-data';
import {
  createSiloBuilderBriefRecord,
  createSiloBuilderBriefRecords,
  type SiloBriefInput,
} from '@/lib/silo-builder/silo-brief-studio';

function buildHubSpokeBriefContent(targetKeyword: string, title: string): string {
  return [
    `# SEO Content Brief: ${title}`,
    '',
    '## Strategy Overview',
    `* **Primary Keyword:** ${targetKeyword}`,
    `* **Target H1:** ${title}`,
    '* **Source:** Hub & Spoke Architecture Generator cluster page',
    '',
    '## Content Direction',
    'Draft this supporting cluster article to strengthen topical authority and link back to the pillar guide using the anchor text defined in your Hub & Spoke map.',
    '',
    '## Semantic SEO & Entities',
    `* **Primary Keyword:** ${targetKeyword}`,
    '* **Secondary Keywords & LSI Terms:** Expand from your Hub & Spoke semantic entity list.',
    '',
    '## Internal Linking Strategy',
    '* Link back to the pillar page with the anchor text from your Hub & Spoke map.',
  ].join('\n');
}

export async function createHubSpokeBrief(
  targetKeyword: string,
  title: string,
  workspaceId: string
): Promise<ContentBriefRecord> {
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);

  const brief = await prisma.contentBrief.create({
    data: {
      targetKeyword: targetKeyword.trim(),
      targetUrl: '',
      content: buildHubSpokeBriefContent(targetKeyword.trim(), title.trim()),
    },
    include: {
      articles: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  const record: ContentBriefRecord = {
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

  await prisma.articleStudioHistory.create({
    data: {
      workspaceId: scopedWorkspaceId,
      identifier: record.targetKeyword,
      resultData: {
        ...record,
        legacyBriefId: record.id,
        projectId: scopedWorkspaceId,
      },
    },
  });

  return record;
}

export async function createHubSpokeBriefs(
  spokes: Array<{ targetKeyword: string; title: string }>,
  workspaceId: string
): Promise<ContentBriefRecord[]> {
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  const records: ContentBriefRecord[] = [];

  for (const spoke of spokes) {
    const targetKeyword = spoke.targetKeyword.trim();
    const title = spoke.title.trim();

    if (!targetKeyword) {
      continue;
    }

    const brief = await prisma.contentBrief.create({
      data: {
        targetKeyword,
        targetUrl: '',
        content: buildHubSpokeBriefContent(targetKeyword, title || targetKeyword),
      },
      include: {
        articles: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    const record: ContentBriefRecord = {
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

    await prisma.articleStudioHistory.create({
      data: {
        workspaceId: scopedWorkspaceId,
        identifier: record.targetKeyword,
        resultData: {
          ...record,
          legacyBriefId: record.id,
          projectId: scopedWorkspaceId,
        },
      },
    });

    records.push(record);
  }

  return records;
}

export async function createSiloBuilderBrief(
  input: SiloBriefInput,
  workspaceId: string
): Promise<ContentBriefRecord> {
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  return createSiloBuilderBriefRecord(scopedWorkspaceId, input);
}

export async function createSiloBuilderBriefs(
  nodes: SiloBriefInput[],
  workspaceId: string
): Promise<ContentBriefRecord[]> {
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  return createSiloBuilderBriefRecords(scopedWorkspaceId, nodes);
}

export async function createKeywordAuditBrief(
  targetKeyword: string,
  title: string,
  content: string,
  workspaceId: string
): Promise<ContentBriefRecord> {
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);

  const brief = await prisma.contentBrief.create({
    data: {
      targetKeyword: targetKeyword.trim(),
      targetUrl: '',
      content: content.trim(),
    },
    include: {
      articles: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  const record: ContentBriefRecord = {
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

  await prisma.articleStudioHistory.create({
    data: {
      workspaceId: scopedWorkspaceId,
      identifier: record.targetKeyword,
      resultData: {
        ...record,
        legacyBriefId: record.id,
        projectId: scopedWorkspaceId,
        source: 'keyword-audit',
      },
    },
  });

  return record;
}

export async function getArticleStudioData(workspaceId: string): Promise<ArticleStudioData> {
  const scopedWorkspaceId = workspaceId?.trim();
  if (!scopedWorkspaceId) {
    return { briefs: [], articles: [] };
  }

  const historyEntries = await prisma.articleStudioHistory.findMany({
    where: { workspaceId: scopedWorkspaceId },
    orderBy: { updatedAt: 'desc' },
  });

  const briefIds = new Set<number>();

  for (const entry of historyEntries) {
    const parsed = parseArticleStudioHistoryPayload(entry.resultData);
    if (parsed?.legacyBriefId) {
      briefIds.add(parsed.legacyBriefId);
    }
  }

  if (briefIds.size === 0) {
    return { briefs: [], articles: [] };
  }

  const briefs = await prisma.contentBrief.findMany({
    where: { id: { in: Array.from(briefIds) } },
    include: {
      articles: {
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mappedBriefs: ContentBriefRecord[] = briefs.map(brief => ({
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
  }));

  const articles = mappedBriefs.flatMap(brief => brief.articles);

  return {
    briefs: mappedBriefs,
    articles,
  };
}

export async function deleteContentBrief(
  briefId: number,
  workspaceId: string
): Promise<void> {
  if (!Number.isInteger(briefId) || briefId <= 0) {
    throw new Error('Invalid brief id');
  }

  const scopedWorkspaceId = requireWorkspaceId(workspaceId);

  const brief = await prisma.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error('Content brief not found');
  }

  const historyEntries = await prisma.articleStudioHistory.findMany({
    where: { workspaceId: scopedWorkspaceId },
    select: { id: true, resultData: true },
  });

  const linkedHistoryIds = historyEntries
    .filter(entry => {
      const parsed = parseArticleStudioHistoryPayload(entry.resultData);
      return parsed?.legacyBriefId === briefId;
    })
    .map(entry => entry.id);

  if (linkedHistoryIds.length > 0) {
    await prisma.articleStudioHistory.deleteMany({
      where: { id: { in: linkedHistoryIds } },
    });
  }

  await prisma.contentBrief.delete({
    where: { id: briefId },
  });
}

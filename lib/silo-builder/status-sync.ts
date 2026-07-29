import { getPrisma } from '@/lib/prisma';
import { parseSiloLinkMetadata } from '@/lib/silo-builder/silo-link-metadata';
import { assertSiloNodeAccess, assertSiloProjectAccess } from '@/lib/silo-builder/security';
import type { SiloNodeStatus } from '@/lib/silo-builder/types';
import { toNodeDto } from '@/lib/silo-builder/persist';

type WordPressCredentials = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

function normalizeWordPressSiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')}`;
}

async function resolveWordPressCredentials(
  integrationId: string | null,
  workspaceId: string
): Promise<WordPressCredentials | null> {
  const prisma = getPrisma();

  const config = integrationId
    ? await prisma.integrationConfig.findFirst({
        where: { id: integrationId, workspaceId },
        select: {
          wordpressSiteUrl: true,
          wordpressUsername: true,
          wordpressAppPassword: true,
        },
      })
    : await prisma.integrationConfig.findFirst({
        where: { workspaceId },
        select: {
          wordpressSiteUrl: true,
          wordpressUsername: true,
          wordpressAppPassword: true,
        },
      });

  if (
    !config?.wordpressSiteUrl?.trim() ||
    !config.wordpressUsername?.trim() ||
    !config.wordpressAppPassword?.trim()
  ) {
    return null;
  }

  return {
    siteUrl: config.wordpressSiteUrl.trim(),
    username: config.wordpressUsername.trim(),
    appPassword: config.wordpressAppPassword.replace(/\s+/g, ''),
  };
}

async function fetchWordPressPostStatus(
  creds: WordPressCredentials,
  postId: number
): Promise<'draft' | 'publish' | 'future' | 'pending' | null> {
  const siteUrl = normalizeWordPressSiteUrl(creds.siteUrl);
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64');

  const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${postId}`, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { status?: string };
  if (payload.status === 'publish' || payload.status === 'draft') {
    return payload.status;
  }

  if (payload.status === 'future' || payload.status === 'pending') {
    return payload.status;
  }

  return null;
}

function hasSubstantialArticleContent(content: string | null | undefined): boolean {
  return Boolean(content && content.trim().length > 80);
}

function resolveStatusFromSignals(input: {
  currentStatus: SiloNodeStatus;
  hasNodeContent: boolean;
  hasArticleContent: boolean;
  wpPostStatus: 'draft' | 'publish' | null;
  historyState?: string;
  existingPublishedAt?: Date | null;
}): {
  status: SiloNodeStatus;
  wpPostStatus: 'draft' | 'publish' | null;
  publishedAt: Date | null;
} {
  if (input.wpPostStatus === 'publish') {
    return {
      status: 'PUBLISHED',
      wpPostStatus: 'publish',
      publishedAt: input.existingPublishedAt ?? new Date(),
    };
  }

  if (input.currentStatus === 'PUBLISHED' && input.wpPostStatus !== 'draft') {
    return {
      status: 'PUBLISHED',
      wpPostStatus: 'publish',
      publishedAt: input.existingPublishedAt ?? new Date(),
    };
  }

  if (
    input.hasNodeContent ||
    input.hasArticleContent ||
    input.historyState === 'generated' ||
    input.historyState === 'published' ||
    input.wpPostStatus === 'draft' ||
    input.currentStatus === 'COMPLETED' ||
    input.currentStatus === 'PUBLISHED'
  ) {
    return {
      status: 'COMPLETED',
      wpPostStatus: input.wpPostStatus,
      publishedAt: null,
    };
  }

  if (input.currentStatus === 'QUEUED' || input.currentStatus === 'GENERATING') {
    return {
      status: input.currentStatus,
      wpPostStatus: input.wpPostStatus,
      publishedAt: null,
    };
  }

  if (input.currentStatus === 'FAILED') {
    return {
      status: 'FAILED',
      wpPostStatus: input.wpPostStatus,
      publishedAt: null,
    };
  }

  return {
    status: 'DRAFT',
    wpPostStatus: input.wpPostStatus,
    publishedAt: null,
  };
}

async function findArticleStudioHistoryForNode(
  workspaceId: string,
  nodeId: string,
  preferredHistoryId?: string | null
) {
  const prisma = getPrisma();

  if (preferredHistoryId) {
    const preferred = await prisma.articleStudioHistory.findFirst({
      where: { id: preferredHistoryId, workspaceId },
    });
    if (preferred) {
      return preferred;
    }
  }

  const entries = await prisma.articleStudioHistory.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  for (const entry of entries) {
    const metadata = parseSiloLinkMetadata(entry.resultData);
    if (metadata?.siloNodeId === nodeId) {
      return entry;
    }
  }

  return null;
}

export async function linkSiloNodeArticleStudioHistory(
  nodeId: string,
  articleStudioHistoryId: string
): Promise<void> {
  const prisma = getPrisma();
  await prisma.siloNode.update({
    where: { id: nodeId },
    data: { articleStudioHistoryId },
  });
}

export async function recordSiloNodeWordPressPublish(input: {
  nodeId: string;
  workspaceId: string;
  wpPostId: number;
  wpPostStatus: 'draft' | 'publish';
  articleStudioHistoryId?: string | null;
}): Promise<void> {
  await assertSiloNodeAccess(input.nodeId, input.workspaceId);
  const prisma = getPrisma();

  const isLive = input.wpPostStatus === 'publish';

  await prisma.siloNode.update({
    where: { id: input.nodeId },
    data: {
      wpPostId: input.wpPostId,
      wpPostStatus: input.wpPostStatus,
      status: isLive ? 'PUBLISHED' : 'COMPLETED',
      publishedAt: isLive ? new Date() : null,
      articleStudioHistoryId: input.articleStudioHistoryId ?? undefined,
    },
  });

  if (input.articleStudioHistoryId) {
    const history = await prisma.articleStudioHistory.findFirst({
      where: { id: input.articleStudioHistoryId, workspaceId: input.workspaceId },
    });

    if (history?.resultData && typeof history.resultData === 'object') {
      const record = history.resultData as Record<string, unknown>;
      await prisma.articleStudioHistory.update({
        where: { id: history.id },
        data: {
          resultData: {
            ...record,
            wpPostId: input.wpPostId,
            wpPostStatus: input.wpPostStatus,
            wpPublishedAt: isLive ? new Date().toISOString() : record.wpPublishedAt,
            state: isLive ? 'published' : record.state ?? 'generated',
          },
        },
      });
    }
  }
}

export async function syncSiloNodeStatus(
  nodeId: string,
  workspaceId: string
) {
  const { projectId } = await assertSiloNodeAccess(nodeId, workspaceId);
  const prisma = getPrisma();

  const node = await prisma.siloNode.findFirst({
    where: { id: nodeId, projectId },
    include: { project: true },
  });

  if (!node) {
    throw new Error('Node not found');
  }

  if (node.status === 'QUEUED' || node.status === 'GENERATING') {
    return toNodeDto(node);
  }

  const history = await findArticleStudioHistoryForNode(
    workspaceId,
    nodeId,
    node.articleStudioHistoryId
  );

  const metadata = history ? parseSiloLinkMetadata(history.resultData) : null;
  let hasArticleContent = false;

  if (metadata?.siloNodeId === nodeId) {
    const legacyBriefId =
      typeof (history?.resultData as Record<string, unknown> | undefined)?.legacyBriefId ===
      'number'
        ? ((history?.resultData as Record<string, unknown>).legacyBriefId as number)
        : typeof (history?.resultData as Record<string, unknown> | undefined)?.id ===
            'number'
          ? ((history?.resultData as Record<string, unknown>).id as number)
          : null;

    if (legacyBriefId) {
      const article = await prisma.article.findFirst({
        where: { briefId: legacyBriefId },
        orderBy: { updatedAt: 'desc' },
      });
      hasArticleContent = hasSubstantialArticleContent(article?.content);
    }
  }

  let wpPostStatus =
    node.wpPostStatus === 'publish' || node.wpPostStatus === 'draft'
      ? node.wpPostStatus
      : metadata?.wpPostStatus ?? null;
  let wpPostId = node.wpPostId ?? metadata?.wpPostId ?? null;

  if (wpPostId && node.project.integrationId) {
    const creds = await resolveWordPressCredentials(
      node.project.integrationId,
      workspaceId
    );

    if (creds) {
      const remoteStatus = await fetchWordPressPostStatus(creds, wpPostId);
      if (remoteStatus === 'publish' || remoteStatus === 'draft') {
        wpPostStatus = remoteStatus;
      }
    }
  }

  const resolved = resolveStatusFromSignals({
    currentStatus: node.status as SiloNodeStatus,
    hasNodeContent: hasSubstantialArticleContent(node.content),
    hasArticleContent,
    wpPostStatus,
    historyState: metadata?.state,
    existingPublishedAt: node.publishedAt,
  });

  const updated = await prisma.siloNode.update({
    where: { id: nodeId },
    data: {
      status: resolved.status,
      wpPostId,
      wpPostStatus: resolved.wpPostStatus,
      publishedAt: resolved.publishedAt,
      articleStudioHistoryId: history?.id ?? node.articleStudioHistoryId,
    },
  });

  return toNodeDto(updated);
}

export async function syncSiloProjectStatuses(
  projectId: string,
  workspaceId: string
) {
  await assertSiloProjectAccess(projectId, workspaceId);

  const prisma = getPrisma();
  const nodes = await prisma.siloNode.findMany({
    where: { projectId },
    select: { id: true, status: true },
  });

  const syncable = nodes.filter(
    node =>
      node.status !== 'QUEUED' &&
      node.status !== 'GENERATING' &&
      node.status !== 'FAILED'
  );

  const updated = [];
  for (const node of syncable) {
    updated.push(await syncSiloNodeStatus(node.id, workspaceId));
  }

  return updated;
}

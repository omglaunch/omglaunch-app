import { NextResponse } from 'next/server';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { requireAccessibleProjectWriteFromSources } from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { saveToolHistory } from '@/lib/tool-history/server';
import { prisma } from '@/lib/prisma';
import { parseSiloLinkMetadata } from '@/lib/silo-builder/silo-link-metadata';
import { syncSiloNodeStatus } from '@/lib/silo-builder/status-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SaveArticleDraftRequest = {
  draftId?: string | null;
  articleId: number;
  content: string;
  title?: string;
  identifier: string;
  resultData: unknown;
  workspaceId?: string;
  projectId?: string;
};

function extractTitleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function isSaveArticleDraftRequest(body: unknown): body is SaveArticleDraftRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as SaveArticleDraftRequest;
  return (
    typeof candidate.articleId === 'number' &&
    Number.isInteger(candidate.articleId) &&
    candidate.articleId > 0 &&
    typeof candidate.content === 'string' &&
    typeof candidate.identifier === 'string' &&
    candidate.identifier.trim().length > 0 &&
    candidate.resultData !== undefined &&
    (candidate.draftId === undefined ||
      candidate.draftId === null ||
      typeof candidate.draftId === 'string') &&
    (candidate.title === undefined || typeof candidate.title === 'string')
  );
}

function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.name === 'ZodError') {
    return NextResponse.json({ error: fallbackMessage }, { status: 400 });
  }
  return handleProjectScopedRouteError(error, fallbackMessage);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isSaveArticleDraftRequest(body)) {
    return NextResponse.json(
      { error: 'articleId, content, identifier, and resultData are required' },
      { status: 400 }
    );
  }

  const draftRequest = body;

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId: draftRequest.projectId,
        workspaceId: draftRequest.workspaceId,
      });

      const existing = await prisma.article.findUnique({
        where: { id: draftRequest.articleId },
        include: { brief: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      const content = draftRequest.content;
      const title =
        draftRequest.title?.trim() ||
        extractTitleFromMarkdown(content, existing.brief.targetKeyword);

      const article = await prisma.article.update({
        where: { id: draftRequest.articleId },
        data: { title, content },
      });

      const entry = await saveToolHistory('article-studio', {
        id: draftRequest.draftId?.trim() || undefined,
        identifier: draftRequest.identifier.trim(),
        resultData: draftRequest.resultData,
        workspaceId: projectId,
      });

      const siloLink = parseSiloLinkMetadata(draftRequest.resultData);
      if (siloLink?.siloNodeId) {
        try {
          await syncSiloNodeStatus(siloLink.siloNodeId, projectId);
        } catch (syncError) {
          console.error('Failed to sync silo node status after draft save:', syncError);
        }
      }

      return NextResponse.json({
        article,
        draftId: entry.id,
      });
    });
  } catch (error) {
    return handleRouteError(error, 'Failed to save article draft');
  }
}

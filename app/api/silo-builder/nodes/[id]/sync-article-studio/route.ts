import { NextResponse } from 'next/server';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { getServerActiveProjectId } from '@/lib/projects/active-project-server';
import { getPrisma } from '@/lib/prisma';
import { syncSiloNodeToArticleStudio } from '@/lib/silo-builder/article-studio-sync';
import { assertSiloNodeAccess, isSiloAccessDeniedError } from '@/lib/silo-builder/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SyncBody = {
  articleStudioProjectId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const nodeId = params.id?.trim();
  if (!nodeId) {
    return NextResponse.json({ error: 'Node id is required' }, { status: 400 });
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    // Optional body
  }

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getAuthenticatedWorkspaceId();
    await assertSiloNodeAccess(nodeId, workspaceId);

    const prisma = getPrisma();
    const node = await prisma.siloNode.findUnique({
      where: { id: nodeId },
      include: { project: true },
    });

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    if (node.status !== 'COMPLETED' || !node.content?.trim()) {
      return NextResponse.json(
        { error: 'Only completed articles with generated content can be synced.' },
        { status: 400 }
      );
    }

    const articleStudioProjectId =
      body.articleStudioProjectId?.trim() || (await getServerActiveProjectId());

    if (!articleStudioProjectId) {
      return NextResponse.json(
        { error: 'Select a project before syncing to Article Studio.' },
        { status: 400 }
      );
    }

    const link = await syncSiloNodeToArticleStudio({
      articleStudioProjectId,
      nodeId: node.id,
      projectId: node.projectId,
      projectTitle: node.project.title,
      title: node.title,
      targetKeyword: node.targetKeyword ?? node.title,
      intent: node.intent,
      htmlContent: node.content,
    });

    return NextResponse.json({
      synced: true,
      briefId: link.briefId,
      articleId: link.articleId,
    });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { getPrisma } from '@/lib/prisma';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { enqueueSiloGenerationJobs } from '@/lib/silo-builder/queue';
import { assertSiloProjectAccess, isSiloAccessDeniedError } from '@/lib/silo-builder/security';
import { getServerActiveProjectId } from '@/lib/projects/active-project-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type GenerateBody = {
  projectId?: string;
  nodeIds?: string[];
  articleStudioProjectId?: string;
};

export async function POST(request: Request) {
  let body: GenerateBody;

  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const nodeIds = body.nodeIds?.filter(Boolean);

  if (!projectId || !nodeIds?.length) {
    return NextResponse.json(
      { error: 'projectId and nodeIds are required' },
      { status: 400 }
    );
  }

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = await getAuthenticatedWorkspaceId();

    const rateLimit = await checkUserRateLimit(userId);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await assertSiloProjectAccess(projectId, workspaceId);

    const prisma = getPrisma();
    const validNodes = await prisma.siloNode.findMany({
      where: { projectId, id: { in: nodeIds } },
      select: { id: true },
    });

    const validIds = validNodes.map(n => n.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid nodes found' }, { status: 400 });
    }

    await prisma.siloNode.updateMany({
      where: { id: { in: validIds } },
      data: { status: 'QUEUED' },
    });

    let mode: 'inline' | 'qstash' = 'inline';
    const articleStudioProjectId =
      body.articleStudioProjectId?.trim() || (await getServerActiveProjectId());

    try {
      mode = await enqueueSiloGenerationJobs(
        workspaceId,
        userId,
        projectId,
        validIds,
        articleStudioProjectId
      );
    } catch (enqueueError) {
      await prisma.siloNode.updateMany({
        where: { id: { in: validIds }, status: 'QUEUED' },
        data: { status: 'FAILED' },
      });
      throw enqueueError;
    }

    if (mode === 'inline') {
      return NextResponse.json({
        queued: validIds.length,
        nodeIds: validIds,
        mode,
        completed: true,
      });
    }

    return NextResponse.json({ queued: validIds.length, nodeIds: validIds, mode });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Enqueue failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

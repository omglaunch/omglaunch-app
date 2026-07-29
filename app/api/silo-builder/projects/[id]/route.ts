import { NextResponse } from 'next/server';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { fetchProjectWithNodes } from '@/lib/silo-builder/persist';
import {
  assertSiloProjectCreator,
  isSiloAccessDeniedError,
} from '@/lib/silo-builder/security';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getAuthenticatedWorkspaceId();
    const project = await fetchProjectWithNodes(
      context.params.id,
      workspaceId,
      session.user.id
    );
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getPrisma } = await import('@/lib/prisma');

    await assertSiloProjectCreator(context.params.id, session.user.id);
    await getPrisma().siloProject.deleteMany({ where: { id: context.params.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}

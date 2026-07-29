import { NextResponse } from 'next/server';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import {
  assertSiloProjectAccess,
  isSiloAccessDeniedError,
} from '@/lib/silo-builder/security';
import { fetchProjectWithNodes } from '@/lib/silo-builder/persist';
import { syncSiloProjectStatuses } from '@/lib/silo-builder/status-sync';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    await assertSiloProjectAccess(context.params.id, workspaceId);

    await syncSiloProjectStatuses(context.params.id, workspaceId);

    const project = await fetchProjectWithNodes(context.params.id, workspaceId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Status sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

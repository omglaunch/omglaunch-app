import { NextResponse } from 'next/server';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { importTopicalMapAsSiloProject } from '@/lib/silo-builder/persist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ImportBody = {
  topicalMapId?: string;
};

export async function POST(request: Request) {
  let body: ImportBody;

  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const topicalMapId = body.topicalMapId?.trim();
  if (!topicalMapId) {
    return NextResponse.json({ error: 'topicalMapId is required' }, { status: 400 });
  }

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = await getAuthenticatedWorkspaceId();
    const result = await importTopicalMapAsSiloProject(userId, workspaceId, topicalMapId);

    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Import failed';
    const status = message === 'Topical map not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

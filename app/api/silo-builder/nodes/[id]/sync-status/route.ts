import { NextResponse } from 'next/server';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import {
  assertSiloNodeAccess,
  isSiloAccessDeniedError,
} from '@/lib/silo-builder/security';
import {
  recordSiloNodeWordPressPublish,
  syncSiloNodeStatus,
} from '@/lib/silo-builder/status-sync';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

type SyncStatusBody = {
  wpPostId?: number;
  wpPostStatus?: 'draft' | 'publish';
  articleStudioHistoryId?: string | null;
};

function parseSyncStatusBody(body: unknown): SyncStatusBody | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as SyncStatusBody;
  if (
    typeof record.wpPostId === 'number' &&
    (record.wpPostStatus === 'draft' || record.wpPostStatus === 'publish')
  ) {
    return {
      wpPostId: record.wpPostId,
      wpPostStatus: record.wpPostStatus,
      articleStudioHistoryId:
        typeof record.articleStudioHistoryId === 'string'
          ? record.articleStudioHistoryId
          : null,
    };
  }

  return null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    await assertSiloNodeAccess(context.params.id, workspaceId);

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const publishEvent = parseSyncStatusBody(body);
    if (publishEvent) {
      await recordSiloNodeWordPressPublish({
        nodeId: context.params.id,
        workspaceId,
        wpPostId: publishEvent.wpPostId!,
        wpPostStatus: publishEvent.wpPostStatus!,
        articleStudioHistoryId: publishEvent.articleStudioHistoryId,
      });
    }

    const node = await syncSiloNodeStatus(context.params.id, workspaceId);
    return NextResponse.json({ node });
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

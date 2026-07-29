import { NextResponse } from 'next/server';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { createSpokeFromGap } from '@/lib/silo-builder/create-spoke-from-gap';
import {
  assertSiloProjectAccess,
  isSiloAccessDeniedError,
} from '@/lib/silo-builder/security';
import type { SemanticGap } from '@/lib/silo-builder/semantic-gaps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PostBody = {
  projectId?: string;
  gapTopic?: string;
  gapRationale?: string;
  gapPriority?: SemanticGap['priority'];
};

function parseGapPriority(value: unknown): SemanticGap['priority'] {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}

export async function POST(request: Request) {
  let body: PostBody;

  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const gapTopic = body.gapTopic?.trim();
  const gapRationale = body.gapRationale?.trim();

  if (!projectId || !gapTopic || !gapRationale) {
    return NextResponse.json(
      { error: 'projectId, gapTopic, and gapRationale are required' },
      { status: 400 }
    );
  }

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getAuthenticatedWorkspaceId();
    await assertSiloProjectAccess(projectId, workspaceId);

    const node = await createSpokeFromGap({
      projectId,
      workspaceId,
      gap: {
        topic: gapTopic,
        rationale: gapRationale,
        priority: parseGapPriority(body.gapPriority),
      },
    });

    return NextResponse.json({ node });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to create spoke';
    const status = message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

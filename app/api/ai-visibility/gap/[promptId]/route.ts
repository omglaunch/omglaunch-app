import { NextResponse } from 'next/server';
import { buildVisibilityGapHydration } from '@/lib/ai-visibility/gap-fill';
import { findVisibilityRowForProject } from '@/lib/ai-visibility/visibility-repository';
import {
  requireAccessibleProjectId,
  ProjectAccessError,
} from '@/lib/projects/team-access';
import {
  requireWorkspaceId,
} from '@/lib/projects/tenant-scope';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { promptId: string };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspaceId = await requireWorkspaceId();
    const { searchParams } = new URL(request.url);
    const projectId = await requireAccessibleProjectId(searchParams.get('projectId'));
    const promptId = decodeURIComponent(context.params.promptId ?? '').trim();

    if (!promptId) {
      return NextResponse.json({ error: 'prompt_id is required' }, { status: 400 });
    }

    const row = await findVisibilityRowForProject(promptId, projectId, workspaceId);
    if (!row) {
      return NextResponse.json(
        { error: 'Visibility gap not found for this project' },
        { status: 404 }
      );
    }

    if (row.projectId && row.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Prompt does not belong to the selected project' },
        { status: 403 }
      );
    }

    const hydration = buildVisibilityGapHydration(row);

    return NextResponse.json(hydration, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load visibility gap';
    const status = message.includes('projectId is required') ? 400 : 500;
    console.error('[ai-visibility/gap/[promptId]] GET', error);
    return NextResponse.json({ error: message }, { status });
  }
}

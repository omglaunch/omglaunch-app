import { NextResponse } from 'next/server';
import { buildVisibilitySnapshot } from '@/lib/ai-visibility/visibility-repository';
import { requireAccessibleProjectId, ProjectAccessError } from '@/lib/projects/team-access';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-side aggregation endpoint.
 * Reads from persisted VisibilityPrompt rows per project.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = await requireAccessibleProjectId(searchParams.get('projectId'));
    const snapshot = await buildVisibilitySnapshot(projectId);
    return NextResponse.json({
      snapshot,
      source: 'database',
      cache: 'none',
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load visibility snapshot';
    console.error('[ai-visibility/snapshot] GET error:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

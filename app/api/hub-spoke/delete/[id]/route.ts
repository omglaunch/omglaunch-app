import { NextResponse } from 'next/server';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import {
  resolveAccessibleProjectWriteFromSources,
} from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { deleteTopicalMap } from '@/lib/topical-map/persistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { id: string };
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const { id } = context.params;
      const { searchParams } = new URL(request.url);
      const projectId = await resolveAccessibleProjectWriteFromSources({
        projectId: searchParams.get('projectId'),
        workspaceId: searchParams.get('workspaceId'),
        campaignId: searchParams.get('campaignId'),
      });

      if (!projectId) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      }

      const deleted = await deleteTopicalMap(id, projectId);

      if (!deleted) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error('[hub-spoke/delete] DELETE', error);
    return handleProjectScopedRouteError(error, 'Failed to delete strategy');
  }
}

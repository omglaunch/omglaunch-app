import { NextResponse } from 'next/server';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolveAccessibleProjectFromSources } from '@/lib/projects/team-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { getCompetitorIntelRun } from '@/lib/competitor-intel/persistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { id: string };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const { id } = context.params;
      const { searchParams } = new URL(request.url);
      const projectId = await resolveAccessibleProjectFromSources({
        projectId: searchParams.get('projectId'),
        workspaceId: searchParams.get('workspaceId'),
        campaignId: searchParams.get('campaignId'),
      });

      if (!projectId) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }

      const run = await getCompetitorIntelRun(id, projectId);

      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }

      return NextResponse.json({ run });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to load competitor intel run');
  }
}

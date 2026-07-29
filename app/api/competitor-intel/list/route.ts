import { NextResponse } from 'next/server';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolveAccessibleProjectFromSources } from '@/lib/projects/team-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { listCompetitorIntelRuns } from '@/lib/competitor-intel/persistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const { searchParams } = new URL(request.url);
      const projectId = await resolveAccessibleProjectFromSources({
        projectId: searchParams.get('projectId'),
        workspaceId: searchParams.get('workspaceId'),
        campaignId: searchParams.get('campaignId'),
      });

      if (!projectId) {
        return NextResponse.json({ runs: [] });
      }

      const runs = await listCompetitorIntelRuns(projectId);
      return NextResponse.json({ runs });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to list competitor intel runs');
  }
}

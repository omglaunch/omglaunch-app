import { NextResponse } from 'next/server';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolveAccessibleProjectFromSources } from '@/lib/projects/team-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { listTopicalMaps } from '@/lib/topical-map/persistence';

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
        return NextResponse.json({ maps: [] });
      }

      const maps = await listTopicalMaps(projectId);

      return NextResponse.json({ maps });
    });
  } catch (error) {
    console.error('[hub-spoke/list] GET', error);
    return handleProjectScopedRouteError(error, 'Failed to list Hub & Spoke maps');
  }
}

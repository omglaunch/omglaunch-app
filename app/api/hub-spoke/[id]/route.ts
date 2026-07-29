import { NextResponse } from 'next/server';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import {
  resolveAccessibleProjectFromSources
} from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { getTopicalMapById } from '@/lib/topical-map/persistence';

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
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      }

      const record = await getTopicalMapById(id, projectId);

      if (!record) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      }

      return NextResponse.json({
        map: {
          id: record.id,
          seedKeyword: record.seedKeyword,
          location: record.location,
          mapData: record.mapData,
          createdAt: record.createdAt,
          updatedAt: record.createdAt,
        },
      });
    });
  } catch (error) {
    console.error('[hub-spoke/[id]] GET', error);
    return handleProjectScopedRouteError(error, 'Failed to load strategy');
  }
}

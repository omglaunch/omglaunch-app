import { NextResponse } from 'next/server';
import { isHubSpokeMap } from '@/lib/hub-spoke-data';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { requireAccessibleProjectWriteFromSources } from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { saveTopicalMap } from '@/lib/topical-map/persistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LOCATION = 'Malaysia';

type SaveHubSpokeRequest = {
  seedKeyword: string;
  location?: string;
  mapData: unknown;
  workspaceId?: string;
  projectId?: string;
  campaignId?: string;
};

function isSaveHubSpokeRequest(body: unknown): body is SaveHubSpokeRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as SaveHubSpokeRequest;
  return typeof candidate.seedKeyword === 'string' && candidate.mapData !== undefined;
}

export async function POST(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      if (!isSaveHubSpokeRequest(body)) {
        return NextResponse.json(
          { error: 'seedKeyword and mapData are required' },
          { status: 400 }
        );
      }

      const seedKeyword = body.seedKeyword.trim();
      const location = (body.location?.trim() || DEFAULT_LOCATION).trim();

      if (!seedKeyword) {
        return NextResponse.json({ error: 'seedKeyword is required' }, { status: 400 });
      }

      if (!isHubSpokeMap(body.mapData)) {
        return NextResponse.json({ error: 'mapData is invalid or incomplete' }, { status: 400 });
      }

      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId: body.projectId,
        workspaceId: body.workspaceId,
        campaignId: body.campaignId,
      });

      const saved = await saveTopicalMap(projectId, seedKeyword, location, body.mapData);

      return NextResponse.json({
        map: {
          id: saved.id,
          seedKeyword,
          location,
          mapData: body.mapData,
          createdAt: saved.createdAt.toISOString(),
          updatedAt: saved.createdAt.toISOString(),
        },
      });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to save Hub & Spoke map');
  }
}

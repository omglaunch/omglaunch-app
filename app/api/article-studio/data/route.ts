import { NextResponse } from 'next/server';
import { getArticleStudioData } from '@/app/actions/content-pipeline';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolveAccessibleProjectFromSources } from '@/lib/projects/team-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';

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
        return NextResponse.json({ briefs: [], articles: [] });
      }

      const data = await getArticleStudioData(projectId);
      return NextResponse.json(data);
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to load article studio data');
  }
}

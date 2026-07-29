import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import {
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolveAccessibleProjectFromSources } from '@/lib/projects/team-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const { searchParams } = new URL(request.url);
      const projectId = await resolveAccessibleProjectFromSources({
        projectId: searchParams.get('projectId'),
        workspaceId: searchParams.get('workspaceId'),
        campaignId: searchParams.get('campaignId'),
      });

      if (!projectId) {
        return NextResponse.json({ audits: [] });
      }

      const audits = await getPrisma().localAuditHistory.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          shareToken: true,
          keyword: true,
          gridSize: true,
          platform: true,
          solvScore: true,
          saivScore: true,
          createdAt: true,
        },
      });

      return NextResponse.json({ audits, projectId });
    });
  } catch (error) {
    console.error('[local-dominance/geogrid/history]', error);
    return handleProjectScopedRouteError(error, 'Failed to load history');
  }
}

import { NextResponse } from 'next/server';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import {
  requireAccessibleProjectWriteFromSources
} from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { normalizeToolSlug } from '@/lib/tool-history/registry';
import { migrateToolHistoryEntries } from '@/lib/tool-history/server';
import type { MigrateToolHistoryInput } from '@/lib/tool-history/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { tool: string };
};

function invalidToolResponse() {
  return NextResponse.json({ error: 'Unknown tool history type' }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const tool = normalizeToolSlug(context.params.tool);

  if (!tool) {
    return invalidToolResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as MigrateToolHistoryInput).entries)
  ) {
    return NextResponse.json({ error: 'entries array is required' }, { status: 400 });
  }

  const input = body as MigrateToolHistoryInput & {
    campaignId?: string;
    projectId?: string;
  };

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
      });

      const result = await migrateToolHistoryEntries(tool, {
        ...input,
        workspaceId: projectId,
      });
      return NextResponse.json(result);
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to migrate tool history');
  }
}

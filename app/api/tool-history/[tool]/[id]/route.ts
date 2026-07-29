import { NextResponse } from 'next/server';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import {
  requireAccessibleProjectWriteFromSources,
  resolveAccessibleProjectFromSources,
  resolveAccessibleProjectWriteFromSources,
} from '@/lib/projects/team-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { normalizeToolSlug } from '@/lib/tool-history/registry';
import {
  deleteToolHistoryEntry,
  getToolHistoryEntry,
  updateToolHistory,
} from '@/lib/tool-history/server';
import type { UpdateToolHistoryInput } from '@/lib/tool-history/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { tool: string; id: string };
};

function invalidToolResponse() {
  return NextResponse.json({ error: 'Unknown tool history type' }, { status: 404 });
}

async function resolveReadProjectScopeFromRequest(
  request: Request,
  body?: UpdateToolHistoryInput & { campaignId?: string; projectId?: string }
): Promise<string | null> {
  const { searchParams } = new URL(request.url);
  return resolveAccessibleProjectFromSources({
    projectId: body?.projectId ?? searchParams.get('projectId'),
    workspaceId: body?.workspaceId ?? searchParams.get('workspaceId'),
    campaignId: body?.campaignId ?? searchParams.get('campaignId'),
  });
}

async function resolveWriteProjectScopeFromRequest(
  request: Request,
  body?: UpdateToolHistoryInput & { campaignId?: string; projectId?: string }
): Promise<string | null> {
  const { searchParams } = new URL(request.url);
  return resolveAccessibleProjectWriteFromSources({
    projectId: body?.projectId ?? searchParams.get('projectId'),
    workspaceId: body?.workspaceId ?? searchParams.get('workspaceId'),
    campaignId: body?.campaignId ?? searchParams.get('campaignId'),
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = context.params;
  const tool = normalizeToolSlug(context.params.tool);

  if (!tool) {
    return invalidToolResponse();
  }

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const projectId = await resolveReadProjectScopeFromRequest(request);

      if (!projectId) {
        return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
      }

      const entry = await getToolHistoryEntry(tool, id, projectId);

      if (!entry) {
        return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
      }

      return NextResponse.json({ entry });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to load history entry');
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = context.params;
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

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const payload = body as UpdateToolHistoryInput & {
    campaignId?: string;
    projectId?: string;
  };

  if (payload.resultData === undefined) {
    return NextResponse.json({ error: 'resultData is required' }, { status: 400 });
  }

  if (payload.identifier !== undefined && typeof payload.identifier !== 'string') {
    return NextResponse.json({ error: 'identifier must be a string' }, { status: 400 });
  }

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const { searchParams } = new URL(request.url);
      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId: payload.projectId ?? searchParams.get('projectId'),
        workspaceId: payload.workspaceId ?? searchParams.get('workspaceId'),
        campaignId: payload.campaignId ?? searchParams.get('campaignId'),
      });

      const entry = await updateToolHistory(tool, id, {
        ...payload,
        workspaceId: projectId,
      });
      return NextResponse.json({ entry });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to update history entry');
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = context.params;
  const tool = normalizeToolSlug(context.params.tool);

  if (!tool) {
    return invalidToolResponse();
  }

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const projectId = await resolveWriteProjectScopeFromRequest(request);

      if (!projectId) {
        return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
      }

      const deleted = await deleteToolHistoryEntry(tool, id, projectId);

      if (!deleted) {
        return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to delete history entry');
  }
}

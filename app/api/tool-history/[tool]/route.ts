import { NextResponse } from 'next/server';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import {
  requireAccessibleProjectWriteFromSources,
  resolveAccessibleProjectFromSources,
} from '@/lib/projects/team-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { normalizeToolSlug } from '@/lib/tool-history/registry';
import {
  getLatestToolHistoryByIdentifier,
  listToolHistory,
  saveToolHistory,
} from '@/lib/tool-history/server';
import type { SaveToolHistoryInput } from '@/lib/tool-history/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { tool: string };
};

function invalidToolResponse() {
  return NextResponse.json({ error: 'Unknown tool history type' }, { status: 404 });
}

export async function GET(request: Request, context: RouteContext) {
  const tool = normalizeToolSlug(context.params.tool);

  if (!tool) {
    return invalidToolResponse();
  }

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const { searchParams } = new URL(request.url);
      const identifier = searchParams.get('identifier')?.trim();
      const projectId = await resolveAccessibleProjectFromSources({
        projectId: searchParams.get('projectId'),
        workspaceId: searchParams.get('workspaceId'),
        campaignId: searchParams.get('campaignId'),
      });

      if (!projectId) {
        if (identifier) {
          return NextResponse.json({ entry: null });
        }
        return NextResponse.json({ entries: [] });
      }

      if (identifier) {
        const entry = await getLatestToolHistoryByIdentifier(tool, identifier, projectId);
        return NextResponse.json({ entry });
      }

      const limitParam = searchParams.get('limit');
      const limit = limitParam ? Number(limitParam) : 50;
      const entries = await listToolHistory(tool, {
        limit: Number.isFinite(limit) ? limit : 50,
        workspaceId: projectId,
      });

      return NextResponse.json({ entries });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to list tool history');
  }
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
    typeof (body as SaveToolHistoryInput).identifier !== 'string' ||
    (body as SaveToolHistoryInput).resultData === undefined
  ) {
    return NextResponse.json(
      { error: 'identifier and resultData are required' },
      { status: 400 }
    );
  }

  const input = body as SaveToolHistoryInput & {
    campaignId?: string;
    projectId?: string;
  };
  const identifier = input.identifier.trim();

  if (!identifier) {
    return NextResponse.json({ error: 'identifier is required' }, { status: 400 });
  }

  if (input.id !== undefined && typeof input.id !== 'string') {
    return NextResponse.json({ error: 'id must be a string when provided' }, { status: 400 });
  }

  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
      });

      const entry = await saveToolHistory(tool, {
        ...input,
        identifier,
        workspaceId: projectId,
      });
      return NextResponse.json({ entry });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to save tool history');
  }
}

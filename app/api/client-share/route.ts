import { NextResponse } from 'next/server';
import {
  ClientShareError,
  createClientShareLink,
  revokeClientShareLink,
} from '@/lib/client-share/service';
import { buildClientShareUrl } from '@/lib/client-share/urls';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { requireAccessibleProjectWriteId } from '@/lib/projects/team-access';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CreateBody = {
  projectId?: string;
  reportType?: string;
  sourceId?: string | number | null;
  expiresInDays?: number | null;
  password?: string | null;
};

type RevokeBody = {
  projectId?: string;
  shareId?: string;
};

export async function POST(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const body = (await request.json()) as CreateBody;
      const projectId = await requireAccessibleProjectWriteId(body.projectId);

      if (!body.reportType?.trim()) {
        return NextResponse.json({ error: 'reportType is required' }, { status: 400 });
      }

      const result = await createClientShareLink({
        workspaceId,
        projectId,
        reportType: body.reportType.trim(),
        sourceId: body.sourceId,
        expiresInDays: body.expiresInDays,
        password: body.password,
      });

      return NextResponse.json({
        ...result,
        shareUrl: buildClientShareUrl(result.shareToken, request),
      });
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ClientShareError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[client-share/create]', error);
    return handleProjectScopedRouteError(error, 'Failed to create share link');
  }
}

export async function DELETE(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const body = (await request.json()) as RevokeBody;
      const projectId = await requireAccessibleProjectWriteId(body.projectId);

      if (!body.shareId?.trim()) {
        return NextResponse.json({ error: 'shareId is required' }, { status: 400 });
      }

      await revokeClientShareLink({
        workspaceId,
        projectId,
        shareId: body.shareId.trim(),
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ClientShareError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[client-share/revoke]', error);
    return handleProjectScopedRouteError(error, 'Failed to revoke share link');
  }
}

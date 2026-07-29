import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { mapLocalAuditToSavedAudit } from '@/lib/local-dominance/map-audit-result';
import {
  LocalAuditAccessError,
  requireAccessibleLocalAudit,
  requireAccessibleLocalAuditWrite,
} from '@/lib/local-dominance/project-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Audit id is required' }, { status: 400 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const audit = await requireAccessibleLocalAudit(id);
      return NextResponse.json(mapLocalAuditToSavedAudit(audit));
    });
  } catch (error) {
    if (error instanceof LocalAuditAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('[local-dominance/geogrid/history/get]', error);
    return handleProjectScopedRouteError(error, 'Failed to load audit');
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Audit id is required' }, { status: 400 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      await requireAccessibleLocalAuditWrite(id);
      const { getPrisma } = await import('@/lib/prisma');
      await getPrisma().localAuditHistory.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof LocalAuditAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('[local-dominance/geogrid/history/delete]', error);
    return handleProjectScopedRouteError(error, 'Failed to delete audit');
  }
}

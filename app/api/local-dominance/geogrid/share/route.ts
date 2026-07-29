import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  LocalAuditAccessError,
  requireAccessibleLocalAudit,
} from '@/lib/local-dominance/project-access';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { checkUserRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkUserRateLimit(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = (await request.json()) as { auditId?: string };
    if (!body.auditId?.trim()) {
      return NextResponse.json({ error: 'auditId is required' }, { status: 400 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const audit = await requireAccessibleLocalAudit(body.auditId!);

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

      return NextResponse.json({
        shareToken: audit.shareToken,
        projectId: audit.projectId,
        shareUrl: `${baseUrl.replace(/\/+$/, '')}/report/geogrid/${audit.shareToken}`,
      });
    });
  } catch (error) {
    if (error instanceof LocalAuditAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('[local-dominance/geogrid/share]', error);
    return handleProjectScopedRouteError(error, 'Failed to generate share link');
  }
}

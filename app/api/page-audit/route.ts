import { NextResponse } from 'next/server';
import { getRecentAudits } from '@/lib/page-audit/get-recent-audits';
import {
  savePageAudit,
  type SavePageAuditInput,
} from '@/lib/page-audit/save-audit';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import {
  requireAccessibleProjectWriteFromSources,
  resolveAccessibleProjectFromSources,
} from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isSavePageAuditRequest(body: unknown): body is SavePageAuditInput {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as SavePageAuditInput).url === 'string' &&
    typeof (body as SavePageAuditInput).targetKeyword === 'string'
  );
}

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
        return NextResponse.json({ audits: [] });
      }

      const audits = await getRecentAudits(projectId);
      return NextResponse.json({ audits });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to list page audits');
  }
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

      if (!isSavePageAuditRequest(body)) {
        return NextResponse.json(
          { error: 'url and targetKeyword are required' },
          { status: 400 }
        );
      }

      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId:
          typeof body === 'object' && body !== null && 'projectId' in body
            ? String((body as { projectId?: string }).projectId ?? '')
            : undefined,
        workspaceId:
          typeof body === 'object' && body !== null && 'workspaceId' in body
            ? String((body as SavePageAuditInput).workspaceId ?? '')
            : undefined,
        campaignId:
          typeof body === 'object' && body !== null && 'campaignId' in body
            ? String((body as { campaignId?: string }).campaignId ?? '')
            : undefined,
      });

      const trimmedUrl = body.url.trim();
      const trimmedKeyword = body.targetKeyword.trim();

      if (!trimmedUrl || !trimmedKeyword) {
        return NextResponse.json(
          { error: 'url and targetKeyword are required' },
          { status: 400 }
        );
      }

      const audit = await savePageAudit({
        url: trimmedUrl,
        targetKeyword: trimmedKeyword,
        workspaceId: projectId,
      });

      return NextResponse.json({
        id: audit.id,
        url: audit.url,
        targetKeyword: audit.targetKeyword,
        geoScore: audit.geoScore,
        createdAt: audit.createdAt.toISOString(),
        auditData: audit.auditData,
      });
    });
  } catch (error) {
    return handleProjectScopedRouteError(error, 'Failed to save page audit');
  }
}

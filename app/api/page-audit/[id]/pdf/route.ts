import { NextResponse } from 'next/server';
import { parseAuditData } from '@/lib/audit-data';
import { buildAuditPdfFilename, generateAuditPdf } from '@/lib/pdf-generator';
import { getReportBrandingForProject } from '@/lib/projects/client-brand';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import { requireAccessibleProjectId } from '@/lib/projects/team-access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { id: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    const id = parseInt(params.id, 10);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid audit id' }, { status: 400 });
    }

    const audit = await prisma.pageAudit.findUnique({
      where: { id },
    });

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    let branding;

    if (projectId?.trim()) {
      const scopedProjectId = await requireAccessibleProjectId(projectId);
      branding =
        (await getReportBrandingForProject(scopedProjectId, workspaceId)) ?? undefined;
    }

    const data = parseAuditData(audit.auditData);

    const buffer = await generateAuditPdf({
      url: audit.url,
      targetKeyword: audit.targetKeyword,
      geoScore: audit.geoScore,
      createdAt: audit.createdAt,
      data,
      branding,
    });

    const filename = buildAuditPdfFilename(audit.targetKeyword, audit.id);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'PDF generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

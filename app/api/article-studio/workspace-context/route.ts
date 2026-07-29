import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import { getDomainProfileManifestView } from '@/lib/domain-profile/regenerate';
import {
  ProjectAccessError,
  requireAccessibleProjectId,
} from '@/lib/projects/team-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    const { searchParams } = new URL(request.url);
    const projectId = await requireAccessibleProjectId(searchParams.get('projectId'));

    const [project, brandProfile, view] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, workspaceId },
        select: { name: true, domain: true },
      }),
      prisma.aeoBrandProfile.findUnique({
        where: { projectId },
        select: { brandLabel: true, primaryUrl: true },
      }),
      getDomainProfileManifestView(projectId),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const brandName = brandProfile?.brandLabel.trim() || project.name.trim() || 'Client Brand';
    const rawWebsite =
      brandProfile?.primaryUrl.trim() ||
      (project.domain?.trim()
        ? project.domain.trim().startsWith('http')
          ? project.domain.trim()
          : `https://${project.domain.trim()}`
        : 'https://example.com');
    const description = `${brandName} — AI visibility optimized content and entity data.`;

    const draftManifest = view?.draft?.manifest ?? view?.published?.manifest ?? null;
    const publishedManifest = view?.published?.manifest ?? null;

    return NextResponse.json(
      {
        projectId,
        brandName,
        website: rawWebsite,
        description,
        status: view?.status ?? 'PUBLISHED',
        hasPendingDraft: view?.hasPendingDraft ?? false,
        manifest: draftManifest,
        manifestVersion: view?.draft?.version ?? view?.published?.version ?? 0,
        draftManifest,
        draftVersion: view?.draft?.version ?? 0,
        draftUpdatedAt: view?.draft?.updatedAt ?? null,
        publishedManifest,
        publishedVersion: view?.published?.version ?? 0,
        publishedAt: view?.published?.publishedAt ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load workspace context';
    const status = message.includes('projectId is required') ? 400 : 500;
    console.error('[article-studio/workspace-context]', error);
    return NextResponse.json({ error: message }, { status });
  }
}

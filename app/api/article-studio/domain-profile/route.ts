import { NextResponse } from 'next/server';
import { getAuthenticatedSession, getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import { buildManifestHostingUrls } from '@/lib/domain-profile/urls';
import {
  DomainProfilePublishError,
  DomainProfileRegenerationError,
  getDomainProfileManifestView,
  publishDomainProfileManifest,
  regenerateDomainProfileDraft,
} from '@/lib/domain-profile/regenerate';
import { prisma } from '@/lib/prisma';
import { resolvePublicBaseUrl } from '@/lib/rank-tracker/public-url';
import {
  ProjectAccessError,
  ReadOnlyAccessError,
  requireAccessibleProjectId,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = await requireAccessibleProjectId(searchParams.get('projectId'));
    const workspaceId = await getAuthenticatedWorkspaceId();
    const [view, project, brandProfile] = await Promise.all([
      getDomainProfileManifestView(projectId),
      prisma.project.findFirst({
        where: { id: projectId, workspaceId },
        select: { domain: true },
      }),
      prisma.aeoBrandProfile.findUnique({
        where: { projectId },
        select: { primaryUrl: true },
      }),
    ]);

    const hosting = buildManifestHostingUrls(
      projectId,
      resolvePublicBaseUrl(request),
      {
        projectDomain: project?.domain ?? null,
        primaryUrl: brandProfile?.primaryUrl ?? null,
      }
    );

    return NextResponse.json(
      {
        projectId,
        status: view?.status ?? 'PUBLISHED',
        hasPendingDraft: view?.hasPendingDraft ?? false,
        publishedManifest: view?.published?.manifest ?? null,
        publishedVersion: view?.published?.version ?? 0,
        publishedAt: view?.published?.publishedAt ?? null,
        draftManifest: view?.draft?.manifest ?? null,
        draftVersion: view?.draft?.version ?? 0,
        draftUpdatedAt: view?.draft?.updatedAt ?? null,
        projectDomain: project?.domain ?? null,
        primaryUrl: brandProfile?.primaryUrl ?? null,
        website: hosting.website,
        demoManifestUrl: hosting.demoUrl,
        productionManifestUrl: hosting.productionUrl,
        // Backward-compatible fields for existing clients
        manifest: view?.draft?.manifest ?? view?.published?.manifest ?? null,
        version: view?.draft?.version ?? view?.published?.version ?? 0,
        updatedAt: view?.draft?.updatedAt ?? view?.published?.updatedAt ?? null,
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
    const message = error instanceof Error ? error.message : 'Failed to load domain profile';
    const status = message.includes('projectId is required') ? 400 : 500;
    console.error('[article-studio/domain-profile]', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { projectId?: string };
    const projectId = await requireAccessibleProjectWriteId(body.projectId);
    const workspaceId = await getAuthenticatedWorkspaceId();
    const session = await getAuthenticatedSession();
    const actor = session?.user?.email
      ? {
          actorName: session.user.name?.trim() || session.user.email,
          actorEmail: session.user.email,
        }
      : undefined;

    const result = await regenerateDomainProfileDraft(projectId, {
      workspaceId,
      actor,
      source: 'api_manual',
    });

    return NextResponse.json(
      {
        projectId,
        status: result.status,
        hasPendingDraft: result.hasPendingDraft,
        draftManifest: result.manifest,
        draftVersion: result.draftVersion,
        publishedVersion: result.publishedVersion,
        manifest: result.manifest,
        version: result.draftVersion,
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ReadOnlyAccessError || error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to regenerate domain profile draft';
    const status = message.includes('projectId is required') ? 400 : 500;
    console.error('[article-studio/domain-profile/regenerate]', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    const workspaceId = await getAuthenticatedWorkspaceId();
    const body = (await request.json().catch(() => ({}))) as { projectId?: string };
    const projectId = await requireAccessibleProjectWriteId(body.projectId);
    const actor = session?.user?.email
      ? {
          actorName: session.user.name?.trim() || session.user.email,
          actorEmail: session.user.email,
        }
      : undefined;

    const result = await publishDomainProfileManifest(projectId, session?.user?.id ?? null, {
      workspaceId,
      actor,
      source: 'api_manual',
    });
    const view = await getDomainProfileManifestView(projectId);

    return NextResponse.json(
      {
        projectId,
        status: view?.status ?? 'PUBLISHED',
        hasPendingDraft: view?.hasPendingDraft ?? false,
        publishedManifest: result.manifest,
        publishedVersion: result.version,
        publishedAt: result.publishedAt,
        webhook: result.webhook,
        draftManifest: view?.draft?.manifest ?? result.manifest,
        draftVersion: view?.draft?.version ?? result.version,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ReadOnlyAccessError || error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DomainProfilePublishError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to publish domain profile';
    const status = message.includes('projectId is required') ? 400 : 500;
    console.error('[article-studio/domain-profile/publish]', error);
    return NextResponse.json({ error: message }, { status });
  }
}

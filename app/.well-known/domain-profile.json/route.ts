import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  getPublishedDomainProfileManifest,
  resolveProjectIdByHost,
  resolveWorkspaceIdByHost,
} from '@/lib/domain-profile/regenerate';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import {
  ProjectAccessError,
  requireAccessibleProjectId,
} from '@/lib/projects/team-access';
import { safeParseDomainProfile } from '@/lib/domain-profile/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function resolveProjectForRequest(request: Request): Promise<string | null> {
  const host = (await headers()).get('host');
  if (host) {
    const byClientHost = await resolveProjectIdByHost(host);
    if (byClientHost) return byClientHost;
  }

  const { searchParams } = new URL(request.url);
  const projectIdParam = searchParams.get('projectId');
  if (projectIdParam?.trim()) {
    try {
      return await requireAccessibleProjectId(projectIdParam);
    } catch (error) {
      if (isUnauthenticatedError(error)) {
        return null;
      }
      throw error;
    }
  }

  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    if (host) {
      const byAgencyHost = await resolveWorkspaceIdByHost(host);
      if (byAgencyHost && byAgencyHost !== workspaceId) {
        return null;
      }
    }
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return null;
    }
    throw error;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const projectId = await resolveProjectForRequest(request);

    if (!projectId) {
      return NextResponse.json(
        {
          error:
            'Domain profile not found — pass ?projectId= for the active client or host the file on the client domain.',
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const profile = await getPublishedDomainProfileManifest(projectId);

    if (!profile) {
      return NextResponse.json(
        {
          error:
            'Domain profile is not published yet. Publish the draft manifest from Settings → Domain Manifest.',
        },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    const validation = safeParseDomainProfile(profile.manifest);
    if (!validation.success) {
      console.warn('[well-known/domain-profile] Invalid stored manifest:', validation.error);
      return NextResponse.json(
        { error: 'Domain profile corrupted' },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(validation.data, {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403, headers: CORS_HEADERS });
    }
    console.error('[well-known/domain-profile]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

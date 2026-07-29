import { NextResponse } from 'next/server';
import {
  getAeoBrandProfile,
  upsertAeoBrandProfile,
} from '@/app/actions/aeo-brand-profile';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import { ProjectAccessError, ReadOnlyAccessError } from '@/lib/projects/team-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: { projectId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const projectId = decodeURIComponent(context.params.projectId ?? '').trim();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const profile = await getAeoBrandProfile(projectId);
    return NextResponse.json({ profile });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load brand profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const projectId = decodeURIComponent(context.params.projectId ?? '').trim();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const body = (await request.json()) as {
      brandLabel?: string;
      primaryUrl?: string;
      brandAliases?: string[];
      entityType?: string;
      contactPhone?: string | null;
      contactEmail?: string | null;
      address?: string | null;
      sameAsUrls?: string[];
    };

    const result = await upsertAeoBrandProfile(projectId, {
      brandLabel: body.brandLabel ?? '',
      primaryUrl: body.primaryUrl ?? '',
      brandAliases: body.brandAliases,
      entityType: body.entityType,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail,
      address: body.address,
      sameAsUrls: body.sameAsUrls,
    });

    return NextResponse.json({
      profile: result.profile,
      rowsUpdated: result.rowsUpdated,
      domainWarning: result.domainWarning,
      manifestRegenScheduled: result.manifestRegenScheduled ?? false,
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ReadOnlyAccessError || error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to save brand profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

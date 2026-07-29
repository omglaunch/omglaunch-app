import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  extractAeoMetadataFromContent,
  AeoExtractError,
} from '@/lib/article-studio/extract-aeo-metadata';
import { ExtractAeoMetadataRequestSchema } from '@/lib/article-studio/gap-analysis-types';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getAuthenticatedWorkspaceId();
    const body = await request.json();
    const parsed = ExtractAeoMetadataRequestSchema.parse(body);

    const { result, creditsDeducted } = await extractAeoMetadataFromContent({
      workspaceId,
      userId: session.user.id,
      content: parsed.content,
      keywordTargets: parsed.keywordTargets,
      cluster: parsed.cluster,
    });

    return NextResponse.json(
      { result, creditsDeducted },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof AeoExtractError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid extraction request' }, { status: 400 });
    }

    console.error('[article-studio/extract-aeo-metadata]', error);
    return NextResponse.json({ error: 'Metadata extraction failed' }, { status: 500 });
  }
}

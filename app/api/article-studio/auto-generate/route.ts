import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  autoGenerateGapArticle,
  AutoGenerateGapArticleError,
} from '@/lib/article-studio/auto-generate-gap-article';
import { AutoGenerateGapArticleRequestSchema } from '@/lib/article-studio/gap-analysis-types';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import { ProjectAccessError, ReadOnlyAccessError, requireAccessibleProjectWriteId } from '@/lib/projects/team-access';

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
    const parsed = AutoGenerateGapArticleRequestSchema.parse(body);
    await requireAccessibleProjectWriteId(parsed.projectId);

    const { result, metadata, content, creditsDeducted } = await autoGenerateGapArticle({
      workspaceId,
      userId: session.user.id,
      projectId: parsed.projectId,
      promptId: parsed.promptId,
      promptText: parsed.promptText,
      missingEntities: parsed.missingEntities,
    });

    return NextResponse.json(
      { result, metadata, content, creditsDeducted },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof AutoGenerateGapArticleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ReadOnlyAccessError || error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid auto-generate request' }, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : 'Gap article generation failed';
    console.error('[article-studio/auto-generate]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

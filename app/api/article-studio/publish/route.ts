import { NextResponse } from 'next/server';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';
import {
  publishGapArticle,
  PublishGapArticleError,
} from '@/lib/article-studio/publish-gap-article';
import {
  ProjectAccessError,
  ReadOnlyAccessError,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const projectId = await requireAccessibleProjectWriteId(
      typeof body.projectId === 'string' ? body.projectId : null
    );

    const result = await publishGapArticle({
      workspaceId,
      projectId,
      content: String(body.content ?? ''),
      metadata: body.metadata,
      articleId: typeof body.articleId === 'number' ? body.articleId : undefined,
      briefId: typeof body.briefId === 'number' ? body.briefId : undefined,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof ReadOnlyAccessError || error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof PublishGapArticleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid publish payload' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Failed to publish article';
    const status = message.includes('projectId is required') ? 400 : 500;
    console.error('[article-studio/publish]', error);
    return NextResponse.json({ error: message }, { status });
  }
}

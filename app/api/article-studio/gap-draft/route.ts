import { NextResponse } from 'next/server';
import { runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { requireAccessibleProjectWriteFromSources } from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { saveToolHistory } from '@/lib/tool-history/server';
import { buildGapAnalysisHistoryPayload } from '@/lib/tool-history/gap-analysis-persistence';
import { GapArticleMetadataSchema } from '@/lib/article-studio/gap-analysis-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const record = body as Record<string, unknown>;
    const metadata = GapArticleMetadataSchema.parse(record.metadata);
    const editorContent = typeof record.content === 'string' ? record.content : '';
    const linkedPromptId =
      typeof record.linkedPromptId === 'string' ? record.linkedPromptId : null;
    const draftId = typeof record.draftId === 'string' ? record.draftId.trim() : undefined;

    return await runWithAuthenticatedTenantScope(async () => {
      const projectId = await requireAccessibleProjectWriteFromSources({
        projectId:
          typeof record.projectId === 'string' ? record.projectId : undefined,
        workspaceId:
          typeof record.workspaceId === 'string' ? record.workspaceId : undefined,
      });

      const resultData = buildGapAnalysisHistoryPayload({
        metadata,
        editorContent,
        linkedPromptId,
      });

      const entry = await saveToolHistory('article-studio', {
        id: draftId || undefined,
        identifier: resultData.draftTitle,
        resultData: {
          ...resultData,
          projectId,
        },
        workspaceId: projectId,
      });

      return NextResponse.json({
        draftId: entry.id,
        savedAt: resultData.savedAt,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid gap draft metadata' }, { status: 400 });
    }

    return handleProjectScopedRouteError(error, 'Failed to save gap draft');
  }
}

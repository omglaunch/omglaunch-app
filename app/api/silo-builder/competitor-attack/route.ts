import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { resolvePublicBaseUrl } from '@/lib/rank-tracker/public-url';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { isInsufficientCreditsError } from '@/lib/credits';
import {
  createSiloCompetitorAttackTask,
  loadCompletedSiloCompetitorAttackProject,
  markSiloCompetitorAttackTaskCompleted,
  markSiloCompetitorAttackTaskFailed,
  parseSiloCompetitorAttackTaskMetadata,
  runSiloCompetitorAttackPipeline,
  type SiloCompetitorAttackJobParams,
} from '@/lib/silo-builder/competitor-attack-task';
import {
  isZeroCompetitorKeywordsError,
  workspaceHasOwnDataForSeoCredentials,
} from '@/lib/silo-builder/dataforseo-ranked';
import { resolveCompetitorSiloNiche } from '@/lib/silo-builder/resolve-niche';
import { ZERO_COMPETITOR_KEYWORDS_ERROR } from '@/lib/silo-builder/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type CompetitorAttackBody = {
  domain?: string;
  niche?: string;
  geography?: string;
  integrationId?: string;
  title?: string;
};

function triggerBackgroundWorker(baseUrl: string, taskId: string): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return;
  }

  void fetch(`${baseUrl}/api/silo-builder/competitor-attack/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ taskId }),
  }).catch(error => {
    console.error('[silo-competitor-attack] Failed to trigger background worker:', error);
  });
}

function runPipelineInBackground(taskId: string, jobParams: SiloCompetitorAttackJobParams): void {
  void (async () => {
    try {
      await runSiloCompetitorAttackPipeline(taskId, jobParams);
      await markSiloCompetitorAttackTaskCompleted(taskId);
    } catch (error) {
      await markSiloCompetitorAttackTaskFailed(taskId, error);
    }
  })();
}

export async function GET(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const taskId = new URL(request.url).searchParams.get('taskId')?.trim();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task = await getPrisma().backgroundQueueTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const metadata = parseSiloCompetitorAttackTaskMetadata(task.metadata);

    if (task.state === 'FAILED') {
      return NextResponse.json({
        taskId: task.id,
        state: task.state,
        step: metadata.step ?? 'queued',
        errorCode: metadata.errorCode ?? 'TASK_FAILED',
        error: metadata.errorMessage ?? 'Competitor attack task failed.',
        domain: metadata.domain,
      });
    }

    if (task.state === 'COMPLETED' && metadata.projectId) {
      const workspaceId =
        metadata.workspaceId?.trim() || (await getAuthenticatedWorkspaceId());
      const project = await loadCompletedSiloCompetitorAttackProject(
        metadata.projectId,
        workspaceId,
        userId
      );

      if (!project) {
        return NextResponse.json({
          taskId: task.id,
          state: task.state,
          step: 'complete',
          error: 'Saved project could not be loaded.',
        }, { status: 404 });
      }

      return NextResponse.json({
        taskId: task.id,
        state: task.state,
        step: 'complete',
        project,
        projectId: metadata.projectId,
        domain: metadata.domain,
        geography: metadata.geography,
        niche: metadata.niche,
        keywordsAnalyzed: metadata.keywordsAnalyzed ?? 0,
      });
    }

    return NextResponse.json({
      taskId: task.id,
      state: task.state,
      step: metadata.step ?? 'queued',
      keywordsAnalyzed: metadata.keywordsAnalyzed,
      domain: metadata.domain,
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to poll task status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: CompetitorAttackBody;

  try {
    body = (await request.json()) as CompetitorAttackBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const domain = body.domain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const geography = body.geography?.trim() || 'Malaysia';

  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 });
  }

  const niche = resolveCompetitorSiloNiche(domain, body.niche);

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = await getAuthenticatedWorkspaceId();

    const rateLimit = await checkUserRateLimit(userId);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const [llmCred, hasOwnDataForSeo] = await Promise.all([
      resolveLlmCredential(workspaceId, 'gemini'),
      workspaceHasOwnDataForSeoCredentials(workspaceId),
    ]);

    if (!llmCred) {
      return NextResponse.json({ error: 'Gemini credentials not configured' }, { status: 500 });
    }

    const jobParams: SiloCompetitorAttackJobParams = {
      domain,
      geography,
      niche,
      workspaceId,
      userId,
      integrationId: body.integrationId?.trim(),
      title: body.title?.trim(),
      usesCredits: llmCred.usesCredits,
      hasOwnDataForSeo,
    };

    const taskId = await createSiloCompetitorAttackTask(jobParams);
    if (!taskId) {
      return NextResponse.json(
        { error: 'Failed to initialize background task.' },
        { status: 500 }
      );
    }

    const cronSecret = process.env.CRON_SECRET?.trim();
    if (cronSecret) {
      triggerBackgroundWorker(resolvePublicBaseUrl(request), taskId);
      return NextResponse.json({ taskId, completed: false });
    }

    if (process.env.NODE_ENV === 'development') {
      runPipelineInBackground(taskId, jobParams);
      return NextResponse.json({ taskId, completed: false });
    }

    try {
      const result = await runSiloCompetitorAttackPipeline(taskId, jobParams);
      await markSiloCompetitorAttackTaskCompleted(taskId);

      return NextResponse.json({
        taskId,
        completed: true,
        project: result.project,
        domain: result.domain,
        geography: result.geography,
        niche: result.niche,
        keywordsAnalyzed: result.keywordsAnalyzed,
        projectId: result.projectId,
      });
    } catch (pipelineError) {
      await markSiloCompetitorAttackTaskFailed(taskId, pipelineError);
      throw pipelineError;
    }
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    if (isZeroCompetitorKeywordsError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          errorCode: ZERO_COMPETITOR_KEYWORDS_ERROR,
        },
        { status: 422 }
      );
    }

    const message = error instanceof Error ? error.message : 'Competitor attack map failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

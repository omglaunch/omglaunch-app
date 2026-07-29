import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import {
  isProjectIdRequiredError,
  isTenantAccessDeniedError,
  runWithAuthenticatedTenantScope
} from '@/lib/projects/tenant-scope';
import {
  requireAccessibleProjectWriteFromSources
} from '@/lib/projects/team-access';
import { requireAccessibleProjectId } from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolvePublicBaseUrl } from '@/lib/rank-tracker/public-url';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { isInsufficientCreditsError } from '@/lib/credits';
import {
  COMPETITOR_INTEL_COUNTRIES,
  DEFAULT_COMPETITOR_INTEL_COUNTRY,
  REVERSE_ENGINEER_CREDIT_COST,
} from '@/lib/competitor-intel/constants';
import {
  assertSufficientCredits,
  createReverseEngineerTask,
  markReverseEngineerTaskCompleted,
  markReverseEngineerTaskFailed,
  parseTaskMetadata,
  runReverseEngineerPipeline,
} from '@/lib/competitor-intel/execute-task';
import { getTopicalMapById } from '@/lib/topical-map/persistence';
import { isValidSanitizedDomain, sanitizeTargetDomain } from '@/lib/competitor-intel/sanitize-domain';
import { ZERO_COMPETITOR_KEYWORDS_ERROR } from '@/lib/competitor-intel/dataforseo-ranked-keywords';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type ReverseEngineerRequest = {
  targetDomain: string;
  coreNiche: string;
  targetCountry?: string;
  workspaceId?: string;
  projectId?: string;
};

function isReverseEngineerRequest(body: unknown): body is ReverseEngineerRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as ReverseEngineerRequest;
  return (
    typeof candidate.targetDomain === 'string' &&
    typeof candidate.coreNiche === 'string'
  );
}

function triggerBackgroundWorker(baseUrl: string, taskId: string): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return;
  }

  void fetch(`${baseUrl}/api/reverse-engineer/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ taskId }),
  }).catch(error => {
    console.error('[reverse-engineer] Failed to trigger background worker:', error);
  });
}

export async function GET(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const userId = await getAuthenticatedWorkspaceId();
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

      const metadata = parseTaskMetadata(task.metadata);

      if (task.state === 'FAILED') {
        return NextResponse.json({
          taskId: task.id,
          state: task.state,
          step: metadata.step ?? 'queued',
          errorCode: metadata.errorCode ?? 'TASK_FAILED',
          error: metadata.errorMessage ?? 'Reverse-engineer task failed.',
        });
      }

      if (task.state === 'COMPLETED' && metadata.mapId) {
        const projectId = metadata.workspaceId;
        if (!projectId) {
          return NextResponse.json({
            taskId: task.id,
            state: task.state,
            step: 'complete',
            error: 'Task completed but workspace metadata is missing.',
          }, { status: 500 });
        }

        await requireAccessibleProjectId(projectId);

        const savedMap = await getTopicalMapById(metadata.mapId, projectId);
        if (!savedMap) {
          return NextResponse.json({
            taskId: task.id,
            state: task.state,
            step: 'complete',
            error: 'Saved map could not be loaded.',
          }, { status: 404 });
        }

        return NextResponse.json({
          taskId: task.id,
          state: task.state,
          step: 'complete',
          mapId: metadata.mapId,
          competitorDomain: metadata.competitorDomain,
          coreNiche: metadata.coreNiche,
          targetCountry: metadata.targetCountry,
          keywordsAnalyzed: metadata.keywordsAnalyzed ?? 0,
          semanticGaps: metadata.semanticGaps ?? [],
          map: savedMap.mapData,
        });
      }

      return NextResponse.json({
        taskId: task.id,
        state: task.state,
        step: metadata.step ?? 'queued',
        keywordsAnalyzed: metadata.keywordsAnalyzed,
        competitorDomain: metadata.competitorDomain,
      });
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleProjectScopedRouteError(error, 'Failed to poll task status');
  }
}

export async function POST(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      if (!isReverseEngineerRequest(body)) {
        return NextResponse.json(
          { error: 'targetDomain and coreNiche are required' },
          { status: 400 }
        );
      }

      const targetDomain = body.targetDomain.trim();
      const coreNiche = body.coreNiche.trim();
      const targetCountry =
        body.targetCountry?.trim() || DEFAULT_COMPETITOR_INTEL_COUNTRY;

      if (!targetDomain) {
        return NextResponse.json({ error: 'targetDomain is required' }, { status: 400 });
      }

      if (!coreNiche) {
        return NextResponse.json({ error: 'coreNiche is required' }, { status: 400 });
      }

      const sanitizedDomain = sanitizeTargetDomain(targetDomain);
      if (!isValidSanitizedDomain(sanitizedDomain)) {
        return NextResponse.json(
          { error: 'Enter a valid competitor domain (e.g. competitor.com).' },
          { status: 400 }
        );
      }

      if (
        !COMPETITOR_INTEL_COUNTRIES.includes(
          targetCountry as (typeof COMPETITOR_INTEL_COUNTRIES)[number]
        )
      ) {
        return NextResponse.json({ error: 'Unsupported target country.' }, { status: 400 });
      }

      const userId = await getAuthenticatedWorkspaceId();
      const workspaceId = await requireAccessibleProjectWriteFromSources({
        projectId: body.projectId,
        workspaceId: body.workspaceId,
      });

      await assertSufficientCredits(userId, REVERSE_ENGINEER_CREDIT_COST);

      const jobParams = {
        targetDomain,
        coreNiche,
        targetCountry,
        workspaceId,
        userId,
      };

      const taskId = await createReverseEngineerTask(jobParams);
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

      try {
        const result = await runReverseEngineerPipeline(taskId, jobParams);
        await markReverseEngineerTaskCompleted(taskId);

        return NextResponse.json({
          taskId,
          completed: true,
          mapId: result.mapId,
          competitorDomain: result.competitorDomain,
          coreNiche: result.coreNiche,
          targetCountry: result.targetCountry,
          keywordsAnalyzed: result.keywordsAnalyzed,
          semanticGaps: result.semanticGaps,
          map: result.map,
        });
      } catch (pipelineError) {
        await markReverseEngineerTaskFailed(taskId, pipelineError);
        throw pipelineError;
      }
    });
  } catch (error) {
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isInsufficientCreditsError(error)) {
      return NextResponse.json(
        { error: 'Insufficient credits to reverse-engineer competitor.' },
        { status: 402 }
      );
    }

    if (error instanceof Error && error.name === ZERO_COMPETITOR_KEYWORDS_ERROR) {
      return NextResponse.json(
        {
          error: error.message,
          errorCode: ZERO_COMPETITOR_KEYWORDS_ERROR,
        },
        { status: 422 }
      );
    }

    const message = error instanceof Error ? error.message : 'Reverse-engineer failed';

    if (isProjectIdRequiredError(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (isTenantAccessDeniedError(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

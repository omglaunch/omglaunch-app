import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { isInsufficientCreditsError } from '@/lib/credits';
import {
  markSiloCompetitorAttackTaskCompleted,
  markSiloCompetitorAttackTaskFailed,
  parseSiloCompetitorAttackTaskMetadata,
  runSiloCompetitorAttackPipeline,
} from '@/lib/silo-builder/competitor-attack-task';
import { isZeroCompetitorKeywordsError } from '@/lib/silo-builder/dataforseo-ranked';
import { ZERO_COMPETITOR_KEYWORDS_ERROR } from '@/lib/silo-builder/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function verifyWorkerAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!verifyWorkerAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const taskId =
    typeof body === 'object' &&
    body !== null &&
    'taskId' in body &&
    typeof (body as { taskId: unknown }).taskId === 'string'
      ? (body as { taskId: string }).taskId.trim()
      : '';

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  const task = await getPrisma().backgroundQueueTask.findUnique({
    where: { id: taskId },
  });

  if (!task || task.state !== 'RUNNING') {
    return NextResponse.json({ error: 'Task not runnable' }, { status: 404 });
  }

  const metadata = parseSiloCompetitorAttackTaskMetadata(task.metadata);
  if (!metadata.workspaceId || !metadata.domain || !metadata.geography || !metadata.niche) {
    return NextResponse.json({ error: 'Task metadata is incomplete' }, { status: 400 });
  }

  const jobParams = {
    domain: metadata.domain,
    geography: metadata.geography,
    niche: metadata.niche,
    workspaceId: metadata.workspaceId,
    userId: task.userId,
    integrationId: metadata.integrationId,
    title: metadata.title,
    usesCredits: metadata.usesCredits ?? true,
    hasOwnDataForSeo: metadata.hasOwnDataForSeo ?? false,
  };

  try {
    await runSiloCompetitorAttackPipeline(taskId, jobParams);
    await markSiloCompetitorAttackTaskCompleted(taskId);
    return NextResponse.json({ ok: true, taskId });
  } catch (error) {
    await markSiloCompetitorAttackTaskFailed(taskId, error);

    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (isZeroCompetitorKeywordsError(error)) {
      return NextResponse.json(
        { error: error.message, errorCode: ZERO_COMPETITOR_KEYWORDS_ERROR },
        { status: 422 }
      );
    }

    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits.' }, { status: 402 });
    }

    const message = error instanceof Error ? error.message : 'Worker failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

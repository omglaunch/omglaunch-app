import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { isInsufficientCreditsError } from '@/lib/credits';
import { ZERO_COMPETITOR_KEYWORDS_ERROR } from '@/lib/competitor-intel/dataforseo-ranked-keywords';
import {
  markReverseEngineerTaskCompleted,
  markReverseEngineerTaskFailed,
  parseTaskMetadata,
  runReverseEngineerPipeline,
} from '@/lib/competitor-intel/execute-task';

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

  const metadata = parseTaskMetadata(task.metadata);
  if (
    !metadata.workspaceId ||
    !metadata.coreNiche ||
    !metadata.targetDomain ||
    !metadata.targetCountry
  ) {
    return NextResponse.json({ error: 'Task metadata is incomplete' }, { status: 400 });
  }

  const jobParams = {
    targetDomain: metadata.targetDomain,
    coreNiche: metadata.coreNiche,
    targetCountry: metadata.targetCountry,
    workspaceId: metadata.workspaceId,
    userId: task.userId,
  };

  try {
    await runReverseEngineerPipeline(taskId, jobParams);
    await markReverseEngineerTaskCompleted(taskId);
    return NextResponse.json({ ok: true, taskId });
  } catch (error) {
    await markReverseEngineerTaskFailed(taskId, error);

    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof Error && error.name === ZERO_COMPETITOR_KEYWORDS_ERROR) {
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

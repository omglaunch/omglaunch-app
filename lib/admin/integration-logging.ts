import { prisma } from '@/lib/prisma';

export type IntegrationType =
  | 'DATAFORSEO'
  | 'GEMINI'
  | 'OPENAI'
  | 'WORDPRESS'
  | 'WEBHOOK';

export type IntegrationStatus = 'SUCCESS' | 'FAILURE' | 'TIMEOUT';

export type IntegrationHealthParams = {
  workspaceId?: string;
  integrationType: IntegrationType | string;
  status: IntegrationStatus;
  httpStatus?: number;
  latencyMs?: number;
  targetUrl?: string;
  errorMessage?: string;
};

/** High-resolution monotonic clock for precise latency (sub-ms). */
export function startLatencyTimer(): number {
  return performance.now();
}

export function elapsedLatencyMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

/**
 * Writes one row to IntegrationHealthLog. Never throws — telemetry must not
 * break user-facing generation or rank-tracker flows.
 */
export async function logIntegrationHealth(params: IntegrationHealthParams): Promise<void> {
  try {
    await prisma.integrationHealthLog.create({
      data: {
        workspaceId: params.workspaceId,
        integrationType: params.integrationType,
        status: params.status,
        httpStatus: params.httpStatus,
        latencyMs: params.latencyMs,
        targetUrl: params.targetUrl,
        errorMessage: params.errorMessage?.slice(0, 4000),
      },
    });
  } catch (error) {
    console.error('[integration-logging] Failed to persist health log:', error);
  }
}

export async function trackBackgroundTask(params: {
  userId: string;
  taskType: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const task = await prisma.backgroundQueueTask.create({
      data: {
        userId: params.userId,
        taskType: params.taskType,
        state: 'RUNNING',
        metadata: params.metadata ?? undefined,
      },
    });
    return task.id;
  } catch (error) {
    console.error('[integration-logging] Failed to track background task:', error);
    return null;
  }
}

export async function completeBackgroundTask(
  taskId: string | null | undefined,
  state: 'COMPLETED' | 'FAILED' = 'COMPLETED'
): Promise<void> {
  if (!taskId) return;

  try {
    await prisma.backgroundQueueTask.update({
      where: { id: taskId },
      data: { state, completedAt: new Date() },
    });
  } catch (error) {
    console.error('[integration-logging] Failed to complete background task:', error);
  }
}

/** Marks long-running RUNNING tasks as STUCK so the admin queue console can surface them. */
export async function markStaleQueueTasks(staleAfterMs = 10 * 60 * 1000): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - staleAfterMs);
    const result = await prisma.backgroundQueueTask.updateMany({
      where: {
        state: 'RUNNING',
        startedAt: { lt: cutoff },
      },
      data: { state: 'STUCK' },
    });
    return result.count;
  } catch (error) {
    console.error('[integration-logging] Failed to mark stale queue tasks:', error);
    return 0;
  }
}

/**
 * Runs an async job under a tracked BackgroundQueueTask. Always attempts to
 * mark the task COMPLETED or FAILED in a finally block.
 */
export async function withBackgroundTask<T>(
  params: {
    userId: string;
    taskType: string;
    metadata?: Record<string, unknown>;
  },
  fn: (taskId: string | null) => Promise<T>
): Promise<T> {
  const taskId = await trackBackgroundTask(params);
  try {
    return await fn(taskId);
  } catch (error) {
    await completeBackgroundTask(taskId, 'FAILED');
    throw error;
  } finally {
    // Only mark completed if still RUNNING (not already FAILED above)
    if (taskId) {
      try {
        const current = await prisma.backgroundQueueTask.findUnique({
          where: { id: taskId },
          select: { state: true },
        });
        if (current?.state === 'RUNNING') {
          await completeBackgroundTask(taskId, 'COMPLETED');
        }
      } catch {
        // swallow — queue bookkeeping must not mask the original result
      }
    }
  }
}

export async function logIntegrationResult(params: {
  workspaceId?: string;
  integrationType: IntegrationType | string;
  targetUrl?: string;
  startedAt: number;
  httpStatus?: number;
  error?: unknown;
  timedOut?: boolean;
}): Promise<void> {
  const latencyMs = elapsedLatencyMs(params.startedAt);
  const errorMessage =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === 'string'
        ? params.error
        : undefined;

  let status: IntegrationStatus = 'SUCCESS';
  if (params.timedOut) {
    status = 'TIMEOUT';
  } else if (params.error || (params.httpStatus != null && params.httpStatus >= 400)) {
    status = 'FAILURE';
  }

  await logIntegrationHealth({
    workspaceId: params.workspaceId,
    integrationType: params.integrationType,
    status,
    httpStatus: params.httpStatus,
    latencyMs,
    targetUrl: params.targetUrl,
    errorMessage,
  });
}

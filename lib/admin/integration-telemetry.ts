import {
  assertIntegrationEnabled,
  isIntegrationEnabled,
} from '@/lib/admin/circuit-breaker';
import {
  elapsedLatencyMs,
  logIntegrationHealth,
  logIntegrationResult,
  startLatencyTimer,
  type IntegrationType,
} from '@/lib/admin/integration-logging';

export type TelemetryContext = {
  integrationType: IntegrationType;
  targetUrl: string;
  workspaceId?: string;
  operation?: string;
  skipCircuitCheck?: boolean;
};

/**
 * Wraps any integration call with circuit-breaker guard, precise latency
 * measurement, and fail-safe health logging. Re-throws the original error
 * after logging so existing error handling stays intact.
 */
export async function withIntegrationTelemetry<T>(
  ctx: TelemetryContext,
  fn: () => Promise<T>
): Promise<T> {
  if (!ctx.skipCircuitCheck) {
    await assertIntegrationEnabled(ctx.integrationType);
  }

  const startedAt = startLatencyTimer();

  try {
    const result = await fn();
    await logIntegrationResult({
      workspaceId: ctx.workspaceId,
      integrationType: ctx.integrationType,
      targetUrl: ctx.targetUrl,
      startedAt,
    });
    return result;
  } catch (error) {
    await logIntegrationResult({
      workspaceId: ctx.workspaceId,
      integrationType: ctx.integrationType,
      targetUrl: ctx.targetUrl,
      startedAt,
      error,
    });
    throw error;
  }
}

/**
 * For fetch-based integrations that return a Response instead of throwing.
 * Logs SUCCESS/FAILURE based on HTTP status without altering return value.
 */
export async function withFetchTelemetry<T>(
  ctx: TelemetryContext,
  fn: () => Promise<{ response: Response; value: T }>
): Promise<{ response: Response; value: T }> {
  if (!ctx.skipCircuitCheck) {
    await assertIntegrationEnabled(ctx.integrationType);
  }

  const startedAt = startLatencyTimer();

  try {
    const { response, value } = await fn();
    const httpStatus = response.status;

    await logIntegrationResult({
      workspaceId: ctx.workspaceId,
      integrationType: ctx.integrationType,
      targetUrl: ctx.targetUrl,
      startedAt,
      httpStatus,
      error: response.ok ? undefined : `HTTP ${httpStatus}`,
    });

    return { response, value };
  } catch (error) {
    await logIntegrationResult({
      workspaceId: ctx.workspaceId,
      integrationType: ctx.integrationType,
      targetUrl: ctx.targetUrl,
      startedAt,
      error,
    });
    throw error;
  }
}

/** Logs an inbound webhook/postback without blocking the handler. */
export async function logInboundWebhook(params: {
  integrationType: IntegrationType | 'WEBHOOK';
  workspaceId?: string;
  targetUrl: string;
  startedAt: number;
  httpStatus: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logIntegrationHealth({
    workspaceId: params.workspaceId,
    integrationType: params.integrationType,
    status: params.success ? 'SUCCESS' : 'FAILURE',
    httpStatus: params.httpStatus,
    latencyMs: elapsedLatencyMs(params.startedAt),
    targetUrl: params.targetUrl,
    errorMessage: params.errorMessage,
  });
}

/** Soft check — returns false when circuit is open, true otherwise (fail-open on errors). */
export async function canUseIntegration(integration: IntegrationType): Promise<boolean> {
  return isIntegrationEnabled(integration);
}

import { getOrCreateSystemConfiguration } from '@/lib/admin/system-config';
import type { IntegrationType } from '@/lib/admin/integration-logging';

const CACHE_TTL_MS = 30_000;
let cachedAt = 0;
let cachedFlags: Record<string, boolean> | null = null;

async function loadCircuitFlags(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (cachedFlags && now - cachedAt < CACHE_TTL_MS) {
    return cachedFlags;
  }

  try {
    const config = await getOrCreateSystemConfiguration();
    cachedFlags = {
      DATAFORSEO: config.dataForSeoEnabled,
      GEMINI: config.geminiEnabled,
      OPENAI: config.openaiEnabled,
      WORDPRESS: config.wordpressWebhooksEnabled,
    };
    cachedAt = now;
    return cachedFlags;
  } catch (error) {
    console.error('[circuit-breaker] Failed to load config — defaulting to enabled:', error);
    return {
      DATAFORSEO: true,
      GEMINI: true,
      OPENAI: true,
      WORDPRESS: true,
    };
  }
}

export class IntegrationCircuitOpenError extends Error {
  constructor(integration: IntegrationType) {
    super(`${integration} integration is disabled by system circuit breaker`);
    this.name = 'IntegrationCircuitOpenError';
  }
}

/** Returns true when the integration is allowed to run. Fail-open on DB errors. */
export async function isIntegrationEnabled(integration: IntegrationType): Promise<boolean> {
  const flags = await loadCircuitFlags();
  return flags[integration] !== false;
}

/** Throws IntegrationCircuitOpenError when the admin has tripped the breaker. */
export async function assertIntegrationEnabled(integration: IntegrationType): Promise<void> {
  const enabled = await isIntegrationEnabled(integration);
  if (!enabled) {
    throw new IntegrationCircuitOpenError(integration);
  }
}

export function invalidateCircuitBreakerCache(): void {
  cachedFlags = null;
  cachedAt = 0;
}

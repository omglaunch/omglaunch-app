import { parseWebhookUrls, isAllowedWebhookUrl } from '@/lib/integrations/webhook-urls';
import { getPrisma } from '@/lib/prisma';
import type { DomainProfile } from './schema';
import { buildProductionManifestUrl } from './urls';
import {
  buildManifestPublishWebhookPayload,
  buildManifestTestWebhookPayload,
  summarizeManifestWebhookDelivery,
  type ManifestWebhookDeliveryResult,
  type ManifestWebhookDispatchResult,
  type ManifestWebhookEvent,
} from './manifest-webhook-shared';

export type {
  ManifestWebhookDeliveryResult,
  ManifestWebhookDispatchResult,
  ManifestWebhookDeliverySummary,
  ManifestWebhookEvent,
} from './manifest-webhook-shared';

export {
  buildManifestPublishWebhookPayload,
  buildManifestTestWebhookPayload,
  buildSampleManifestForWebhookTest,
  extractLatestWebhookDeliveryFromAudit,
  summarizeManifestWebhookDelivery,
} from './manifest-webhook-shared';

const WEBHOOK_TIMEOUT_MS = 15_000;

export async function postManifestWebhook(
  url: string,
  payload: Record<string, unknown>,
  options: {
    projectId: string;
    event: ManifestWebhookEvent;
  }
): Promise<ManifestWebhookDeliveryResult> {
  if (!isAllowedWebhookUrl(url)) {
    return {
      url,
      ok: false,
      error: 'Invalid or disallowed webhook URL',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'omglaunch-manifest-webhook/1.0',
        'X-OMG-Launch-Event': options.event,
        'X-OMG-Launch-Project-Id': options.projectId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    return {
      url,
      ok: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

export async function testManifestWebhookUrl(url: string): Promise<ManifestWebhookDeliveryResult> {
  const payload = buildManifestTestWebhookPayload();
  return postManifestWebhook(url.trim(), payload, {
    projectId: payload.projectId,
    event: 'manifest.test',
  });
}

export async function dispatchManifestPublishWebhooks(input: {
  workspaceId: string;
  projectId: string;
  manifest: DomainProfile;
  version: number;
  publishedAt: string;
}): Promise<ManifestWebhookDispatchResult> {
  const deliveredAt = new Date().toISOString();

  const integration = await getPrisma().integrationConfig.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { webhookUrls: true },
  });

  const urls = parseWebhookUrls(integration?.webhookUrls);
  if (urls.length === 0) {
    return {
      skipped: true,
      reason: 'no_webhooks_configured',
      attempted: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      deliveredAt,
    };
  }

  const [project, brandProfile] = await Promise.all([
    getPrisma().project.findFirst({
      where: { id: input.projectId, workspaceId: input.workspaceId },
      select: { name: true, domain: true },
    }),
    getPrisma().aeoBrandProfile.findUnique({
      where: { projectId: input.projectId },
      select: { primaryUrl: true },
    }),
  ]);

  const productionUrl = buildProductionManifestUrl({
    projectDomain: project?.domain ?? null,
    primaryUrl: brandProfile?.primaryUrl ?? null,
  });

  const payload = buildManifestPublishWebhookPayload({
    projectId: input.projectId,
    projectName: project?.name ?? 'Project',
    projectDomain: project?.domain ?? null,
    manifest: input.manifest,
    version: input.version,
    publishedAt: input.publishedAt,
    productionUrl,
  });

  const payloadRecord = payload as Record<string, unknown>;
  const results: ManifestWebhookDeliveryResult[] = [];

  for (const url of urls) {
    results.push(
      await postManifestWebhook(url, payloadRecord, {
        projectId: input.projectId,
        event: 'manifest.published',
      })
    );
  }

  const succeeded = results.filter(result => result.ok).length;

  return {
    skipped: false,
    attempted: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
    deliveredAt,
  };
}

import type { DomainProfile } from './schema';

export type ManifestWebhookDeliveryResult = {
  url: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
};

export type ManifestWebhookDispatchResult = {
  skipped: boolean;
  reason?: string;
  attempted: number;
  succeeded: number;
  failed: number;
  results: ManifestWebhookDeliveryResult[];
  deliveredAt: string;
};

export type ManifestWebhookDeliverySummary = {
  skipped: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  deliveredAt: string | null;
  results: ManifestWebhookDeliveryResult[];
};

export type ManifestWebhookEvent = 'manifest.published' | 'manifest.test';

export function buildSampleManifestForWebhookTest(): DomainProfile {
  return {
    spec: 'https://ai-domain-data.org/spec/v0.1',
    name: 'Webhook Test Brand',
    website: 'https://example.com',
    description: 'Sample manifest sent by omglaunch webhook test.',
    contact: {
      email: 'hello@example.com',
      url: 'https://example.com',
    },
    entity_type: 'Organization',
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://example.com/#organization',
          name: 'Webhook Test Brand',
          url: 'https://example.com',
        },
      ],
    },
  };
}

export function buildManifestTestWebhookPayload() {
  const publishedAt = new Date().toISOString();
  const productionUrl = 'https://example.com/.well-known/domain-profile.json';

  return {
    event: 'manifest.test' as const,
    test: true,
    projectId: 'webhook-test',
    projectName: 'Webhook Test',
    projectDomain: 'example.com',
    version: 0,
    publishedAt,
    productionUrl,
    manifestUrl: productionUrl,
    manifest: buildSampleManifestForWebhookTest(),
  };
}

export function summarizeManifestWebhookDelivery(
  result: ManifestWebhookDispatchResult
): ManifestWebhookDeliverySummary {
  return {
    skipped: result.skipped,
    attempted: result.attempted,
    succeeded: result.succeeded,
    failed: result.failed,
    deliveredAt: result.skipped ? null : result.deliveredAt,
    results: result.results,
  };
}

export function buildManifestPublishWebhookPayload(input: {
  projectId: string;
  projectName: string;
  projectDomain?: string | null;
  manifest: DomainProfile;
  version: number;
  publishedAt: string;
  productionUrl: string | null;
}) {
  return {
    event: 'manifest.published' as const,
    projectId: input.projectId,
    projectName: input.projectName,
    projectDomain: input.projectDomain ?? null,
    version: input.version,
    publishedAt: input.publishedAt,
    productionUrl: input.productionUrl,
    manifestUrl: input.productionUrl,
    manifest: input.manifest,
  };
}

export function extractLatestWebhookDeliveryFromAudit(
  metadata: Record<string, unknown> | null | undefined
): ManifestWebhookDeliverySummary | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const webhook = metadata.webhook;
  if (!webhook || typeof webhook !== 'object' || Array.isArray(webhook)) {
    return null;
  }

  const value = webhook as Record<string, unknown>;
  if (typeof value.skipped !== 'boolean') {
    return null;
  }

  return {
    skipped: value.skipped,
    attempted: typeof value.attempted === 'number' ? value.attempted : 0,
    succeeded: typeof value.succeeded === 'number' ? value.succeeded : 0,
    failed: typeof value.failed === 'number' ? value.failed : 0,
    deliveredAt: typeof value.deliveredAt === 'string' ? value.deliveredAt : null,
    results: Array.isArray(value.results)
      ? value.results.filter(
          (item): item is ManifestWebhookDeliveryResult =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as ManifestWebhookDeliveryResult).url === 'string' &&
            typeof (item as ManifestWebhookDeliveryResult).ok === 'boolean'
        )
      : [],
  };
}

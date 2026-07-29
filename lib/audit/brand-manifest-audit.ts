import type { Prisma } from '@prisma/client';
import type { AeoBrandProfileRecord } from '@/lib/ai-visibility/aeo-brand-profile';
import { entityTypeLabel, type EntityType } from '@/lib/ai-visibility/entity-type';
import type { ManifestWebhookDeliverySummary } from '@/lib/domain-profile/manifest-webhook-shared';
import { getPrisma } from '@/lib/prisma';

export const AUDIT_CATEGORY = {
  TEAM: 'team',
  BRAND: 'brand',
  MANIFEST: 'manifest',
} as const;

export type AuditCategory = (typeof AUDIT_CATEGORY)[keyof typeof AUDIT_CATEGORY];

export type AuditActor = {
  actorName: string;
  actorEmail: string;
};

export const SYSTEM_AUDIT_ACTOR: AuditActor = {
  actorName: 'System',
  actorEmail: 'system@omglaunch.local',
};

export type AuditLogRecord = {
  id: string;
  action: string;
  category: string | null;
  actorName: string;
  actorEmail: string;
  details: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export async function writeAuditLogEntry(input: {
  workspaceId: string;
  projectId?: string | null;
  category?: AuditCategory | string | null;
  action: string;
  actor: AuditActor;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await getPrisma().auditLogEntry.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId?.trim() || null,
        category: input.category ?? null,
        action: input.action,
        actorName: input.actor.actorName.trim() || SYSTEM_AUDIT_ACTOR.actorName,
        actorEmail: input.actor.actorEmail.trim() || SYSTEM_AUDIT_ACTOR.actorEmail,
        details: input.details?.trim() || null,
        metadata: input.metadata
          ? (input.metadata as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    console.warn('[audit] Failed to write audit log entry:', error);
  }
}

function formatFieldChange(
  label: string,
  before: string | null | undefined,
  after: string | null | undefined
): string | null {
  const prev = before?.trim() ?? '';
  const next = after?.trim() ?? '';
  if (prev === next) return null;
  if (!prev) return `${label}: set to "${next}"`;
  if (!next) return `${label}: cleared (was "${prev}")`;
  return `${label}: "${prev}" → "${next}"`;
}

export function summarizeBrandProfileChanges(
  before: AeoBrandProfileRecord | null,
  after: AeoBrandProfileRecord
): { details: string; metadata: Record<string, unknown> } {
  if (!before) {
    return {
      details: `Created brand profile for ${after.brandLabel}`,
      metadata: {
        event: 'brand.created',
        after,
      },
    };
  }

  const changes: string[] = [];
  const changedFields: Record<string, { before: unknown; after: unknown }> = {};

  const track = (field: string, label: string, prev: unknown, next: unknown) => {
    const prevText = prev == null ? '' : String(prev);
    const nextText = next == null ? '' : String(next);
    if (prevText === nextText) return;
    changedFields[field] = { before: prev, after: next };
    const line = formatFieldChange(label, prevText, nextText);
    if (line) changes.push(line);
  };

  track('brandLabel', 'Brand name', before.brandLabel, after.brandLabel);
  track('primaryUrl', 'Website', before.primaryUrl, after.primaryUrl);
  track(
    'entityType',
    'Entity type',
    entityTypeLabel(before.entityType),
    entityTypeLabel(after.entityType)
  );
  track('contactPhone', 'Phone', before.contactPhone, after.contactPhone);
  track('contactEmail', 'Email', before.contactEmail, after.contactEmail);
  track('address', 'Address', before.address, after.address);

  const beforeSameAs = before.sameAsUrls.join(', ');
  const afterSameAs = after.sameAsUrls.join(', ');
  track('sameAsUrls', 'Profile URLs', beforeSameAs, afterSameAs);

  const beforeAliases = before.brandAliases.join(', ');
  const afterAliases = after.brandAliases.join(', ');
  track('brandAliases', 'Aliases', beforeAliases, afterAliases);

  return {
    details:
      changes.length > 0
        ? changes.join(' · ')
        : `Updated brand profile for ${after.brandLabel}`,
    metadata: {
      event: 'brand.updated',
      changedFields,
    },
  };
}

export async function logBrandProfileAudit(input: {
  workspaceId: string;
  projectId: string;
  before: AeoBrandProfileRecord | null;
  after: AeoBrandProfileRecord;
  actor: AuditActor;
  source?: string;
}): Promise<void> {
  const summary = summarizeBrandProfileChanges(input.before, input.after);

  await writeAuditLogEntry({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    category: AUDIT_CATEGORY.BRAND,
    action: input.before ? 'Brand profile updated' : 'Brand profile created',
    actor: input.actor,
    details: summary.details,
    metadata: {
      ...summary.metadata,
      source: input.source ?? 'manual',
      projectId: input.projectId,
    },
  });
}

export async function logManifestDraftRegeneratedAudit(input: {
  workspaceId: string;
  projectId: string;
  actor: AuditActor;
  draftVersion: number;
  publishedVersion: number;
  status: string;
  source?: string;
}): Promise<void> {
  await writeAuditLogEntry({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    category: AUDIT_CATEGORY.MANIFEST,
    action: 'Manifest draft regenerated',
    actor: input.actor,
    details: `Draft v${input.draftVersion} · published v${input.publishedVersion} · status ${input.status}`,
    metadata: {
      event: 'manifest.draft_regenerated',
      source: input.source ?? 'manual',
      draftVersion: input.draftVersion,
      publishedVersion: input.publishedVersion,
      status: input.status,
    },
  });
}

function formatWebhookDeliveryDetails(
  webhook: ManifestWebhookDeliverySummary | null | undefined
): string | null {
  if (!webhook) return null;
  if (webhook.skipped) {
    return 'No webhooks configured';
  }
  if (webhook.attempted === 0) {
    return null;
  }
  if (webhook.failed === 0) {
    return `Webhook delivered (${webhook.succeeded}/${webhook.attempted} OK)`;
  }
  if (webhook.succeeded === 0) {
    return `Webhook delivery failed (${webhook.failed}/${webhook.attempted})`;
  }
  return `Webhook partially delivered (${webhook.succeeded}/${webhook.attempted} OK)`;
}

export async function logManifestPublishedAudit(input: {
  workspaceId: string;
  projectId: string;
  actor: AuditActor;
  publishedVersion: number;
  entityType: string;
  source?: string;
  webhook?: ManifestWebhookDeliverySummary | null;
}): Promise<void> {
  const webhookDetails = formatWebhookDeliveryDetails(input.webhook);
  const baseDetails = `Published v${input.publishedVersion} (${entityTypeLabel(input.entityType as EntityType) || input.entityType}) to client domain endpoint`;

  await writeAuditLogEntry({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    category: AUDIT_CATEGORY.MANIFEST,
    action: 'Manifest published',
    actor: input.actor,
    details: webhookDetails ? `${baseDetails} · ${webhookDetails}` : baseDetails,
    metadata: {
      event: 'manifest.published',
      source: input.source ?? 'manual',
      publishedVersion: input.publishedVersion,
      entityType: input.entityType,
      webhook: input.webhook ?? null,
    },
  });
}

export async function listProjectBrandManifestAuditLog(
  workspaceId: string,
  projectId: string,
  limit = 25,
  categories: AuditCategory[] = [AUDIT_CATEGORY.BRAND, AUDIT_CATEGORY.MANIFEST]
): Promise<AuditLogRecord[]> {
  const rows = await getPrisma().auditLogEntry.findMany({
    where: {
      workspaceId,
      projectId,
      category: { in: categories },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map(row => ({
    id: row.id,
    action: row.action,
    category: row.category,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    details: row.details,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

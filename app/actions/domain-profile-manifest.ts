'use server';

import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import {
  DomainProfilePublishError,
  DomainProfileRegenerationError,
  getDomainProfileManifestView,
  publishDomainProfileManifest,
  regenerateDomainProfileDraft,
} from '@/lib/domain-profile/regenerate';
import {
  formatManifestPublishValidationError,
  validateLocalEntityNap,
} from '@/lib/domain-profile/entity-publish-requirements';
import { normalizeEntityType } from '@/lib/ai-visibility/entity-type';
import {
  listProjectBrandManifestAuditLog,
  type AuditLogRecord,
} from '@/lib/audit/brand-manifest-audit';
import { resolveAuditActorFromSession } from '@/lib/audit/resolve-audit-actor';
import {
  checkProductionManifestHealth,
  type ProductionManifestHealthResult,
} from '@/lib/domain-profile/production-health';
import type { ManifestWebhookDeliverySummary } from '@/lib/domain-profile/manifest-webhook-shared';
import { getPublishedManifestFromView } from '@/lib/domain-profile/manifest-state';
import {
  assertProjectAccess,
  assertProjectWriteAccess,
} from '@/lib/projects/team-access';
import { assertOwnedProject, requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { getPrisma } from '@/lib/prisma';

export type DomainManifestActionResult = {
  projectId: string;
  status: string;
  hasPendingDraft: boolean;
  draftVersion: number;
  publishedVersion: number;
  publishedAt: string | null;
  webhook: ManifestWebhookDeliverySummary | null;
  publishBlockers: string[];
};

export type DomainManifestAuditEntry = AuditLogRecord;

export type { ProductionManifestHealthResult };

export async function getProductionManifestHealth(
  projectId: string
): Promise<ProductionManifestHealthResult> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  const [project, brandProfile, view] = await Promise.all([
    getPrisma().project.findFirst({
      where: { id: projectId, workspaceId },
      select: { domain: true },
    }),
    getPrisma().aeoBrandProfile.findUnique({
      where: { projectId },
      select: { primaryUrl: true },
    }),
    getDomainProfileManifestView(projectId),
  ]);

  const publishedManifest = view ? getPublishedManifestFromView(view) : null;

  return checkProductionManifestHealth({
    projectDomain: project?.domain ?? null,
    primaryUrl: brandProfile?.primaryUrl ?? null,
    publishedManifest,
  });
}

export async function listDomainManifestAuditLog(
  projectId: string,
  limit = 25
): Promise<DomainManifestAuditEntry[]> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  return listProjectBrandManifestAuditLog(workspaceId, projectId, limit);
}

function serializeActionResult(
  projectId: string,
  view: NonNullable<Awaited<ReturnType<typeof getDomainProfileManifestView>>>,
  webhook: ManifestWebhookDeliverySummary | null = null,
  publishBlockers: string[] = []
): DomainManifestActionResult {
  return {
    projectId,
    status: view.status,
    hasPendingDraft: view.hasPendingDraft,
    draftVersion: view.draft?.version ?? view.published?.version ?? 0,
    publishedVersion: view.published?.version ?? 0,
    publishedAt: view.published?.publishedAt ?? null,
    webhook,
    publishBlockers,
  };
}

async function resolveManifestPublishBlockers(projectId: string): Promise<string[]> {
  const brandProfile = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
    select: {
      brandLabel: true,
      entityType: true,
      contactPhone: true,
      address: true,
    },
  });

  if (!brandProfile) {
    return [];
  }

  const validation = validateLocalEntityNap({
    entityType: normalizeEntityType(brandProfile.entityType),
    brandLabel: brandProfile.brandLabel,
    contactPhone: brandProfile.contactPhone,
    address: brandProfile.address,
  });

  return validation.ok ? [] : validation.errors;
}

export async function getDomainManifestApprovalState(
  projectId: string
): Promise<DomainManifestActionResult | null> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  const view = await getDomainProfileManifestView(projectId);
  if (!view) {
    return null;
  }

  const publishBlockers = await resolveManifestPublishBlockers(projectId);
  return serializeActionResult(projectId, view, null, publishBlockers);
}

export async function regenerateDomainManifestDraft(
  projectId: string
): Promise<DomainManifestActionResult> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectWriteAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  try {
    const actor = await resolveAuditActorFromSession();
    await regenerateDomainProfileDraft(projectId, {
      workspaceId,
      actor,
      source: 'settings_manual',
    });
  } catch (error) {
    if (error instanceof DomainProfileRegenerationError) {
      throw new Error(error.message);
    }
    throw error;
  }

  const view = await getDomainProfileManifestView(projectId);
  if (!view) {
    throw new Error('Draft manifest was not saved.');
  }

  const publishBlockers = await resolveManifestPublishBlockers(projectId);
  return serializeActionResult(projectId, view, null, publishBlockers);
}

export async function publishDomainManifestDraft(
  projectId: string
): Promise<DomainManifestActionResult> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectWriteAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  const session = await getAuthenticatedSession();
  const publishedByUserId = session?.user?.id ?? null;
  const actor = await resolveAuditActorFromSession();

  try {
    const publishResult = await publishDomainProfileManifest(projectId, publishedByUserId, {
      workspaceId,
      actor,
      source: 'settings_manual',
    });

    const view = await getDomainProfileManifestView(projectId);
    if (!view) {
      throw new Error('Published manifest was not saved.');
    }

    const publishBlockers = await resolveManifestPublishBlockers(projectId);
    return serializeActionResult(projectId, view, publishResult.webhook, publishBlockers);
  } catch (error) {
    if (error instanceof DomainProfilePublishError) {
      throw new Error(error.message);
    }
    throw error;
  }
}

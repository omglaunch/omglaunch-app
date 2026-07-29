'use server';

import {
  buildBrandAliases,
  normalizePrimaryUrl,
  serializeBrandProfile,
  type AeoBrandProfileRecord,
  type UpsertAeoBrandProfileInput,
} from '@/lib/ai-visibility/aeo-brand-profile';
import { normalizeEntityType } from '@/lib/ai-visibility/entity-type';
import {
  normalizeOptionalAddress,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
  normalizeSameAsUrls,
} from '@/lib/ai-visibility/nap-sameas';
import { syncVisibilityPromptsFromBrandProfile } from '@/lib/ai-visibility/visibility-repository';
import { validateBrandUrlAgainstProjectDomain } from '@/lib/ai-visibility/brand-url-validation';
import {
  assertProjectAccess,
  assertProjectWriteAccess,
  filterProjectsForAccess,
} from '@/lib/projects/team-access';
import { assertOwnedProject, requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { getPrisma } from '@/lib/prisma';
import {
  AUDIT_CATEGORY,
  listProjectBrandManifestAuditLog,
  logBrandProfileAudit,
  type AuditLogRecord,
} from '@/lib/audit/brand-manifest-audit';
import { resolveAuditActorFromSession } from '@/lib/audit/resolve-audit-actor';
import { notifyDomainManifestBrandChanged } from '@/lib/domain-profile/debounced-regen';

export type AeoBrandProfileSaveResult = {
  profile: AeoBrandProfileRecord;
  rowsUpdated: number;
  domainWarning?: string;
  manifestRegenScheduled?: boolean;
};

export async function getAeoBrandProfile(
  projectId: string
): Promise<AeoBrandProfileRecord | null> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  const record = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
  });

  return record ? serializeBrandProfile(record) : null;
}

export async function upsertAeoBrandProfile(
  projectId: string,
  input: UpsertAeoBrandProfileInput
): Promise<AeoBrandProfileSaveResult> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectWriteAccess(projectId);
  const project = await assertOwnedProject(projectId, workspaceId);

  const brandLabel = input.brandLabel.trim();
  if (!brandLabel) {
    throw new Error('Brand display name is required.');
  }

  const primaryUrl = normalizePrimaryUrl(input.primaryUrl);
  const urlValidation = validateBrandUrlAgainstProjectDomain({
    primaryUrl,
    projectDomain: project.domain,
  });
  if (!urlValidation.ok) {
    throw new Error(urlValidation.error);
  }

  const brandAliases = buildBrandAliases({
    brandLabel,
    primaryUrl,
    extraAliases: input.brandAliases,
  });
  const entityType = normalizeEntityType(input.entityType);
  const contactPhone = normalizeOptionalPhone(input.contactPhone);
  const contactEmail = normalizeOptionalEmail(input.contactEmail);
  const address = normalizeOptionalAddress(input.address);
  const sameAsUrls = normalizeSameAsUrls(input.sameAsUrls ?? []);
  const manifestRegenRequestedAt = new Date();

  const existing = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
  });
  const beforeProfile = existing ? serializeBrandProfile(existing) : null;

  const record = await getPrisma().aeoBrandProfile.upsert({
    where: { projectId },
    create: {
      projectId,
      brandLabel,
      primaryUrl,
      brandAliases,
      entityType,
      contactPhone,
      contactEmail,
      address,
      sameAsUrls,
      manifestRegenRequestedAt,
    },
    update: {
      brandLabel,
      primaryUrl,
      brandAliases,
      entityType,
      contactPhone,
      contactEmail,
      address,
      sameAsUrls,
      manifestRegenRequestedAt,
    },
  });

  const profile = serializeBrandProfile(record);
  const rowsUpdated = await syncVisibilityPromptsFromBrandProfile(projectId, profile);
  notifyDomainManifestBrandChanged(projectId);

  const actor = await resolveAuditActorFromSession();
  await logBrandProfileAudit({
    workspaceId,
    projectId,
    before: beforeProfile,
    after: profile,
    actor,
    source: 'settings',
  });

  return {
    profile,
    rowsUpdated,
    domainWarning: urlValidation.ok ? urlValidation.warning : undefined,
    manifestRegenScheduled: true,
  };
}

/** Re-apply the saved brand profile to all existing visibility matrix rows. */
export async function syncAeoBrandToVisibilityRows(
  projectId: string
): Promise<{ rowsUpdated: number }> {
  await assertProjectWriteAccess(projectId);
  const workspaceId = await requireWorkspaceId();
  await assertOwnedProject(projectId, workspaceId);

  const record = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
  });
  if (!record) {
    throw new Error('Brand profile not found for this project.');
  }

  const profile = serializeBrandProfile(record);
  const rowsUpdated = await syncVisibilityPromptsFromBrandProfile(projectId, profile);
  return { rowsUpdated };
}

export type ProjectWithAeoBrand = {
  id: string;
  name: string;
  domain: string | null;
  profile: AeoBrandProfileRecord | null;
};

export async function listProjectsWithAeoBrand(): Promise<ProjectWithAeoBrand[]> {
  const workspaceId = await requireWorkspaceId();

  const projects = await getPrisma().project.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      domain: true,
      aeoBrandProfile: true,
    },
    orderBy: { name: 'asc' },
  });

  const mapped = projects.map(project => ({
    id: project.id,
    name: project.name,
    domain: project.domain,
    profile: project.aeoBrandProfile
      ? serializeBrandProfile(project.aeoBrandProfile)
      : null,
  }));

  return filterProjectsForAccess(mapped);
}

export type BrandAuditEntry = AuditLogRecord;

export async function listBrandAuditLog(
  projectId: string,
  limit = 15
): Promise<BrandAuditEntry[]> {
  const workspaceId = await requireWorkspaceId();
  await assertProjectAccess(projectId);
  await assertOwnedProject(projectId, workspaceId);

  return listProjectBrandManifestAuditLog(workspaceId, projectId, limit, [
    AUDIT_CATEGORY.BRAND,
  ]);
}

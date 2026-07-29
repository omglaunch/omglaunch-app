import { prisma } from '@/lib/prisma';
import {
  logManifestDraftRegeneratedAudit,
  logManifestPublishedAudit,
  SYSTEM_AUDIT_ACTOR,
  type AuditActor,
} from '@/lib/audit/brand-manifest-audit';
import { normalizeEntityType } from '@/lib/ai-visibility/entity-type';
import { parseSameAsUrlsJson } from '@/lib/ai-visibility/nap-sameas';
import { buildDomainProfileManifest, manifestToPrismaJson } from './generator';
import {
  formatManifestPublishValidationError,
  validateLocalEntityNap,
} from './entity-publish-requirements';
import {
  getDraftManifestFromView,
  getPublishedManifestFromView,
  MANIFEST_STATUS,
  serializeDomainProfileManifestRecord,
  type DomainProfileManifestView,
  type ManifestStatus,
} from './manifest-state';
import {
  summarizeManifestWebhookDelivery,
  type ManifestWebhookDeliverySummary,
} from './manifest-webhook-shared';
import {
  dispatchManifestPublishWebhooks,
} from './manifest-webhook';
import { parseDomainProfile, safeParseDomainProfile } from './schema';
import type { DomainProfile, EntityType } from './schema';

export class DomainProfileRegenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainProfileRegenerationError';
  }
}

export class DomainProfilePublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainProfilePublishError';
  }
}

export type DomainProfileAuditOptions = {
  workspaceId: string;
  actor?: AuditActor;
  source?: string;
};

async function resolveProjectDomainContext(projectId: string, workspaceId: string) {
  const [project, brandProfile] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true, domain: true },
    }),
    prisma.aeoBrandProfile.findUnique({
      where: { projectId },
      select: {
        brandLabel: true,
        primaryUrl: true,
        entityType: true,
        contactPhone: true,
        contactEmail: true,
        address: true,
        sameAsUrls: true,
      },
    }),
  ]);

  if (!project) {
    throw new DomainProfileRegenerationError('Project not found for domain profile.');
  }

  const brandName = brandProfile?.brandLabel.trim() || project.name.trim() || 'Client Brand';
  const rawWebsite =
    brandProfile?.primaryUrl.trim() ||
    (project.domain?.trim()
      ? project.domain.trim().startsWith('http')
        ? project.domain.trim()
        : `https://${project.domain.trim()}`
      : 'https://example.com');
  const description = `${brandName} — AI visibility optimized content and entity data.`;
  const entityType = normalizeEntityType(brandProfile?.entityType) as EntityType;
  const sameAs = parseSameAsUrlsJson(brandProfile?.sameAsUrls);

  return {
    projectId,
    workspaceId,
    brandName,
    website: rawWebsite,
    description,
    contactEmail: brandProfile?.contactEmail?.trim() || null,
    contactTelephone: brandProfile?.contactPhone?.trim() || null,
    address: brandProfile?.address?.trim() || null,
    entityType,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };
}

async function buildValidatedManifest(projectId: string): Promise<DomainProfile> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });

  if (!project) {
    throw new DomainProfileRegenerationError('Project not found.');
  }

  const context = await resolveProjectDomainContext(projectId, project.workspaceId);

  const publishedArticles = await prisma.publishedGapArticle.findMany({
    where: { projectId },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, title: true, cluster: true },
    take: 50,
  });

  const nextManifest = buildDomainProfileManifest(
    context,
    publishedArticles.map(article => ({
      slug: article.slug,
      title: article.title,
      cluster: article.cluster,
    }))
  );

  const validation = safeParseDomainProfile(nextManifest);
  if (!validation.success) {
    throw new DomainProfileRegenerationError(
      `Manifest validation failed: ${validation.error}`
    );
  }

  return validation.data;
}

/**
 * Regenerates the draft manifest. Published manifest is unchanged until approved.
 * The first manifest is draft-only until explicitly published.
 */
export async function regenerateDomainProfileDraft(
  projectId: string,
  audit?: DomainProfileAuditOptions
): Promise<{
  manifest: DomainProfile;
  draftVersion: number;
  status: ManifestStatus;
  publishedVersion: number;
  hasPendingDraft: boolean;
}> {
  const validated = await buildValidatedManifest(projectId);
  const manifestJson = manifestToPrismaJson(validated);

  const result = await prisma.$transaction(
    async tx => {
      const existing = await tx.domainProfileManifest.findUnique({
        where: { projectId },
      });

      if (!existing) {
        const now = new Date();
        const record = await tx.domainProfileManifest.create({
          data: {
            projectId,
            manifest: manifestJson,
            manifestVersion: 0,
            draftManifest: manifestJson,
            draftManifestVersion: 1,
            draftUpdatedAt: now,
            manifestStatus: MANIFEST_STATUS.DRAFT_PENDING,
            publishedAt: null,
            publishedByUserId: null,
            entityType: validated.entity_type,
          },
        });
        return record;
      }

      const nextDraftVersion = Math.max(
        existing.draftManifestVersion,
        existing.manifestVersion
      ) + 1;

      const record = await tx.domainProfileManifest.update({
        where: { projectId },
        data: {
          draftManifest: manifestJson,
          draftManifestVersion: nextDraftVersion,
          draftUpdatedAt: new Date(),
          manifestStatus: MANIFEST_STATUS.DRAFT_PENDING,
          entityType: validated.entity_type,
        },
      });

      return record;
    },
    { isolationLevel: 'Serializable' }
  );

  const view = serializeDomainProfileManifestRecord(result);
  const draftManifest = getDraftManifestFromView(view);
  if (!draftManifest) {
    throw new DomainProfileRegenerationError('Draft manifest unavailable after regeneration.');
  }

  if (audit) {
    await logManifestDraftRegeneratedAudit({
      workspaceId: audit.workspaceId,
      projectId,
      actor: audit.actor ?? SYSTEM_AUDIT_ACTOR,
      draftVersion: view.draft?.version ?? result.draftManifestVersion,
      publishedVersion: view.published?.version ?? result.manifestVersion,
      status: view.status,
      source: audit.source,
    });
  }

  return {
    manifest: draftManifest,
    draftVersion: view.draft?.version ?? result.draftManifestVersion,
    status: view.status,
    publishedVersion: view.published?.version ?? result.manifestVersion,
    hasPendingDraft: view.hasPendingDraft,
  };
}

/** @deprecated Use regenerateDomainProfileDraft — kept for internal callers during migration. */
export async function regenerateDomainProfileManifest(projectId: string): Promise<{
  manifest: ReturnType<typeof parseDomainProfile>;
  version: number;
}> {
  const result = await regenerateDomainProfileDraft(projectId);
  return {
    manifest: result.manifest,
    version: result.draftVersion,
  };
}

export async function publishDomainProfileManifest(
  projectId: string,
  publishedByUserId?: string | null,
  audit?: DomainProfileAuditOptions
): Promise<{
  manifest: DomainProfile;
  version: number;
  publishedAt: string;
  webhook: ManifestWebhookDeliverySummary | null;
}> {
  const existing = await prisma.domainProfileManifest.findUnique({
    where: { projectId },
  });

  if (!existing) {
    throw new DomainProfilePublishError(
      'No domain manifest exists for this project. Regenerate a draft first.'
    );
  }

  const draftSource = existing.draftManifest ?? existing.manifest;
  const parsedDraft = safeParseDomainProfile(draftSource);
  if (!parsedDraft.success) {
    throw new DomainProfilePublishError(
      `Draft manifest is invalid: ${parsedDraft.error}`
    );
  }

  const brandProfile = await prisma.aeoBrandProfile.findUnique({
    where: { projectId },
    select: {
      brandLabel: true,
      entityType: true,
      contactPhone: true,
      address: true,
    },
  });

  const entityType = normalizeEntityType(
    brandProfile?.entityType ?? parsedDraft.data.entity_type
  );
  const napValidation = validateLocalEntityNap({
    entityType,
    brandLabel: brandProfile?.brandLabel ?? parsedDraft.data.name,
    contactPhone: brandProfile?.contactPhone,
    address: brandProfile?.address,
  });

  if (!napValidation.ok) {
    throw new DomainProfilePublishError(formatManifestPublishValidationError(napValidation));
  }

  const publishedAt = new Date();
  const nextPublishedVersion = existing.manifestVersion + 1;

  const record = await prisma.domainProfileManifest.update({
    where: { projectId },
    data: {
      manifest: manifestToPrismaJson(parsedDraft.data),
      manifestVersion: nextPublishedVersion,
      draftManifest: manifestToPrismaJson(parsedDraft.data),
      draftManifestVersion: nextPublishedVersion,
      draftUpdatedAt: publishedAt,
      manifestStatus: MANIFEST_STATUS.PUBLISHED,
      publishedAt,
      publishedByUserId: publishedByUserId?.trim() || null,
      entityType: parsedDraft.data.entity_type,
    },
  });

  let webhook: ManifestWebhookDeliverySummary | null = null;

  const workspaceId =
    audit?.workspaceId ??
    (
      await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      })
    )?.workspaceId;

  if (workspaceId) {
    try {
      const dispatchResult = await dispatchManifestPublishWebhooks({
        workspaceId,
        projectId,
        manifest: parsedDraft.data,
        version: record.manifestVersion,
        publishedAt: publishedAt.toISOString(),
      });
      webhook = summarizeManifestWebhookDelivery(dispatchResult);
    } catch (error) {
      console.warn('[manifest-webhook] Failed to dispatch publish webhooks:', error);
    }
  }

  if (audit) {
    await logManifestPublishedAudit({
      workspaceId: audit.workspaceId,
      projectId,
      actor: audit.actor ?? SYSTEM_AUDIT_ACTOR,
      publishedVersion: record.manifestVersion,
      entityType: parsedDraft.data.entity_type,
      source: audit.source,
      webhook,
    });
  }

  return {
    manifest: parseDomainProfile(record.manifest),
    version: record.manifestVersion,
    publishedAt: publishedAt.toISOString(),
    webhook,
  };
}

export async function getDomainProfileManifestView(
  projectId: string
): Promise<DomainProfileManifestView | null> {
  const record = await prisma.domainProfileManifest.findUnique({
    where: { projectId },
  });

  if (!record) {
    return null;
  }

  return serializeDomainProfileManifestRecord(record);
}

/** Published manifest only — used by public well-known endpoint. */
export async function getPublishedDomainProfileManifest(projectId: string) {
  const view = await getDomainProfileManifestView(projectId);
  if (!view?.published) {
    return null;
  }

  return {
    manifest: view.published.manifest,
    version: view.published.version,
    updatedAt: view.published.updatedAt,
    publishedAt: view.published.publishedAt,
    status: view.status,
    hasPendingDraft: view.hasPendingDraft,
  };
}

/** Backward-compatible helper returning draft-first manifest for internal previews. */
export async function getDomainProfileManifest(projectId: string) {
  const view = await getDomainProfileManifestView(projectId);
  if (!view) {
    return null;
  }

  const manifest = getDraftManifestFromView(view);
  if (!manifest) {
    return null;
  }

  return {
    manifest,
    version: view.draft?.version ?? view.published?.version ?? 0,
    updatedAt: view.draft?.updatedAt ?? view.published?.updatedAt ?? null,
    status: view.status,
    hasPendingDraft: view.hasPendingDraft,
    publishedManifest: view.published?.manifest ?? null,
    publishedVersion: view.published?.version ?? 0,
    publishedAt: view.published?.publishedAt ?? null,
  };
}

function normalizeHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^www\./, '').toLowerCase();
  }
}

/** Resolve a client project from the request host (project.domain). */
export async function resolveProjectIdByHost(host: string): Promise<string | null> {
  const normalizedHost = host.split(':')[0]?.toLowerCase().trim();
  if (!normalizedHost) return null;

  const projects = await prisma.project.findMany({
    where: { domain: { not: null } },
    select: { id: true, domain: true },
  });

  for (const project of projects) {
    const projectHost = normalizeHost(project.domain ?? '');
    if (!projectHost) continue;

    const bareHost = projectHost.replace(/^www\./, '');
    const requestBare = normalizedHost.replace(/^www\./, '');

    if (requestBare === bareHost || requestBare.endsWith(`.${bareHost}`)) {
      return project.id;
    }
  }

  return null;
}

/** Agency white-label portal host → workspace id (legacy). */
export async function resolveWorkspaceIdByHost(host: string): Promise<string | null> {
  const normalizedHost = host.split(':')[0]?.toLowerCase().trim();
  if (!normalizedHost) return null;

  const settings = await prisma.workspaceSettings.findFirst({
    where: {
      customDomain: {
        contains: normalizedHost,
      },
    },
    select: { workspaceId: true, customDomain: true },
  });

  if (!settings?.customDomain) return null;

  try {
    const customUrl = settings.customDomain.startsWith('http')
      ? new URL(settings.customDomain)
      : new URL(`https://${settings.customDomain}`);
    if (customUrl.hostname.toLowerCase() === normalizedHost) {
      return settings.workspaceId;
    }
  } catch {
    if (settings.customDomain.toLowerCase() === normalizedHost) {
      return settings.workspaceId;
    }
  }

  return null;
}

export { getPublishedManifestFromView, getDraftManifestFromView };

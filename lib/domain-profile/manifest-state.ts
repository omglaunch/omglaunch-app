import type { DomainProfile } from './schema';
import { safeParseDomainProfile } from './schema';

export const MANIFEST_STATUS = {
  PUBLISHED: 'PUBLISHED',
  DRAFT_PENDING: 'DRAFT_PENDING',
} as const;

export type ManifestStatus = (typeof MANIFEST_STATUS)[keyof typeof MANIFEST_STATUS];

export type DomainProfileManifestView = {
  projectId: string;
  status: ManifestStatus;
  hasPendingDraft: boolean;
  published: {
    manifest: DomainProfile;
    version: number;
    updatedAt: string;
    publishedAt: string | null;
  } | null;
  draft: {
    manifest: DomainProfile;
    version: number;
    updatedAt: string | null;
  } | null;
};

function parseStoredManifest(
  value: unknown,
  projectId: string,
  label: string
): DomainProfile | null {
  const parsed = safeParseDomainProfile(value);
  if (!parsed.success) {
    console.warn(
      `[domain-profile] Invalid ${label} manifest for project ${projectId}: ${parsed.error}`
    );
    return null;
  }
  return parsed.data;
}

export function serializeDomainProfileManifestRecord(record: {
  projectId: string;
  manifest: unknown;
  manifestVersion: number;
  updatedAt: Date;
  draftManifest?: unknown | null;
  draftManifestVersion?: number | null;
  draftUpdatedAt?: Date | null;
  manifestStatus?: string | null;
  publishedAt?: Date | null;
}): DomainProfileManifestView {
  const isNeverPublished = record.publishedAt == null;
  const status =
    isNeverPublished || record.manifestStatus === MANIFEST_STATUS.DRAFT_PENDING
      ? MANIFEST_STATUS.DRAFT_PENDING
      : MANIFEST_STATUS.PUBLISHED;

  const publishedManifest = parseStoredManifest(record.manifest, record.projectId, 'published');
  const draftManifest = record.draftManifest
    ? parseStoredManifest(record.draftManifest, record.projectId, 'draft')
    : publishedManifest;

  const hasPendingDraft = isNeverPublished
    ? Boolean(draftManifest)
    : status === MANIFEST_STATUS.DRAFT_PENDING &&
      Boolean(draftManifest) &&
      Boolean(publishedManifest) &&
      JSON.stringify(draftManifest) !== JSON.stringify(publishedManifest);

  return {
    projectId: record.projectId,
    status,
    hasPendingDraft,
    published:
      !isNeverPublished && publishedManifest
        ? {
            manifest: publishedManifest,
            version: record.manifestVersion,
            updatedAt: record.updatedAt.toISOString(),
            publishedAt: record.publishedAt?.toISOString() ?? null,
          }
        : null,
    draft: draftManifest
      ? {
          manifest: draftManifest,
          version: record.draftManifestVersion ?? record.manifestVersion,
          updatedAt: record.draftUpdatedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export function getPublishedManifestFromView(
  view: DomainProfileManifestView | null
): DomainProfile | null {
  return view?.published?.manifest ?? null;
}

export function getDraftManifestFromView(
  view: DomainProfileManifestView | null
): DomainProfile | null {
  return view?.draft?.manifest ?? view?.published?.manifest ?? null;
}

import {
  buildBrandAliases,
  deriveManualAliasesFromProfile,
  normalizePrimaryUrl,
  serializeBrandProfile,
  type AeoBrandProfileRecord,
} from '@/lib/ai-visibility/aeo-brand-profile';
import { logBrandProfileAudit, SYSTEM_AUDIT_ACTOR } from '@/lib/audit/brand-manifest-audit';
import { syncVisibilityPromptsFromBrandProfile } from '@/lib/ai-visibility/visibility-repository';
import { notifyDomainManifestBrandChanged } from '@/lib/domain-profile/debounced-regen';
import { requireAccessibleProjectWriteId } from '@/lib/projects/team-access';
import { getPrisma } from '@/lib/prisma';

export type BrandProfileUrlApplyResult = {
  profile: AeoBrandProfileRecord;
  rowsUpdated: number;
};

/**
 * Set the client brand primaryUrl from an auto-discover crawl URL.
 * Rebuilds domain-based aliases while preserving manual extras.
 */
export async function applyDiscoverUrlToProjectProfile(
  projectId: string,
  workspaceId: string,
  discoverUrl: string
): Promise<BrandProfileUrlApplyResult | null> {
  await requireAccessibleProjectWriteId(projectId);

  const record = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
  });
  if (!record) {
    return null;
  }

  const existingProfile = serializeBrandProfile(record);
  const primaryUrl = normalizePrimaryUrl(discoverUrl);
  const manual = deriveManualAliasesFromProfile(existingProfile);
  const brandAliases = buildBrandAliases({
    brandLabel: existingProfile.brandLabel,
    primaryUrl,
    extraAliases: manual,
  });

  const updated = await getPrisma().aeoBrandProfile.update({
    where: { projectId },
    data: {
      primaryUrl,
      brandAliases,
      manifestRegenRequestedAt: new Date(),
    },
  });

  const profile = serializeBrandProfile(updated);
  const rowsUpdated = await syncVisibilityPromptsFromBrandProfile(projectId, profile);
  notifyDomainManifestBrandChanged(projectId);

  await logBrandProfileAudit({
    workspaceId,
    projectId,
    before: existingProfile,
    after: profile,
    actor: SYSTEM_AUDIT_ACTOR,
    source: 'auto_discover_url',
  });

  return { profile, rowsUpdated };
}

import {
  buildBrandAliases,
  mergeGscTokensIntoManualAliases,
  parseGscBrandsInput,
  serializeBrandProfile,
  type AeoBrandProfileRecord,
} from '@/lib/ai-visibility/aeo-brand-profile';
import { syncVisibilityPromptsFromBrandProfile } from '@/lib/ai-visibility/visibility-repository';
import { requireAccessibleProjectWriteId } from '@/lib/projects/team-access';
import { getPrisma } from '@/lib/prisma';

export type BrandProfileMergeResult = {
  profile: AeoBrandProfileRecord;
  rowsUpdated: number;
};

/**
 * Persist GSC exclusion brand tokens into the project's AeoBrandProfile aliases.
 * Merges with existing manual aliases — does not replace label or primary URL.
 */
export async function mergeGscBrandsIntoProjectProfile(
  projectId: string,
  workspaceId: string,
  gscBrandsInput: string
): Promise<BrandProfileMergeResult | null> {
  await requireAccessibleProjectWriteId(projectId);

  const record = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
  });
  if (!record) {
    return null;
  }

  const existingProfile = serializeBrandProfile(record);
  const tokens = parseGscBrandsInput(gscBrandsInput);
  const mergedManual = mergeGscTokensIntoManualAliases(existingProfile, tokens);
  const brandAliases = buildBrandAliases({
    brandLabel: existingProfile.brandLabel,
    primaryUrl: existingProfile.primaryUrl,
    extraAliases: mergedManual,
  });

  const updated = await getPrisma().aeoBrandProfile.update({
    where: { projectId },
    data: { brandAliases },
  });

  const profile = serializeBrandProfile(updated);
  const rowsUpdated = await syncVisibilityPromptsFromBrandProfile(projectId, profile);
  return { profile, rowsUpdated };
}

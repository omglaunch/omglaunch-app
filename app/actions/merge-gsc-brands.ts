'use server';

import {
  mergeGscBrandsIntoProjectProfile,
  type BrandProfileMergeResult,
} from '@/lib/ai-visibility/merge-gsc-brands';
import { requireAccessibleProjectWriteId } from '@/lib/projects/team-access';
import { requireWorkspaceId } from '@/lib/projects/tenant-scope';

export async function mergeGscBrandsIntoAeoBrandProfile(
  projectId: string,
  gscBrandsInput: string
): Promise<BrandProfileMergeResult | null> {
  const workspaceId = await requireWorkspaceId();
  await requireAccessibleProjectWriteId(projectId);
  return mergeGscBrandsIntoProjectProfile(projectId, workspaceId, gscBrandsInput);
}

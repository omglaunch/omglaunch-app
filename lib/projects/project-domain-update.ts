import { validateBrandUrlAgainstProjectDomain } from '@/lib/ai-visibility/brand-url-validation';
import { getPrisma } from '@/lib/prisma';

export type ProjectDomainValidationResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/**
 * When project.domain changes, ensure the saved AEO brand primaryUrl still matches.
 * Blocks the domain update if the brand URL clearly belongs to a different host.
 */
export async function validateProjectDomainChange(
  projectId: string,
  nextDomain: string | null
): Promise<ProjectDomainValidationResult> {
  const brandProfile = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
    select: { primaryUrl: true },
  });

  if (!brandProfile?.primaryUrl?.trim()) {
    return { ok: true };
  }

  const validation = validateBrandUrlAgainstProjectDomain({
    primaryUrl: brandProfile.primaryUrl,
    projectDomain: nextDomain,
  });

  if (!validation.ok) {
    return validation;
  }

  return { ok: true, warning: validation.warning };
}

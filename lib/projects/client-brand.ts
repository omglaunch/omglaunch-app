import { getPrisma } from '@/lib/prisma';
import { serializeBrandProfile } from '@/lib/ai-visibility/aeo-brand-profile';
import { getDomainProfileManifestView } from '@/lib/domain-profile/regenerate';
import { getPublishedManifestFromView } from '@/lib/domain-profile/manifest-state';
import {
  buildReportBranding,
  resolveClientBrandLabel,
  type ClientBrandContext,
  type ReportBranding,
} from '@/lib/projects/client-brand-shared';

export type { ClientBrandContext, ReportBranding } from '@/lib/projects/client-brand-shared';
export {
  resolveClientBrandLabel,
  buildReportBranding,
  getReportExportWarning,
  formatReportBrandingLines,
} from '@/lib/projects/client-brand-shared';

export async function getClientBrandForProject(
  projectId: string,
  workspaceId: string
): Promise<ClientBrandContext | null> {
  const project = await getPrisma().project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      name: true,
      domain: true,
      aeoBrandProfile: true,
    },
  });

  if (!project) {
    return null;
  }

  const profile = project.aeoBrandProfile
    ? serializeBrandProfile(project.aeoBrandProfile)
    : null;

  return {
    projectId: project.id,
    brandLabel: resolveClientBrandLabel({
      brandLabel: profile?.brandLabel,
      projectName: project.name,
    }),
    primaryUrl: profile?.primaryUrl?.trim() || null,
    projectName: project.name,
    projectDomain: project.domain,
  };
}

export async function getReportBrandingForProject(
  projectId: string,
  workspaceId: string
): Promise<ReportBranding | null> {
  const [clientBrand, workspace] = await Promise.all([
    getClientBrandForProject(projectId, workspaceId),
    getPrisma().workspaceSettings.findFirst({
      where: { workspaceId },
      select: {
        name: true,
        reportLogoUrl: true,
        brandPrimaryColor: true,
      },
    }),
  ]);

  if (!clientBrand) {
    return null;
  }

  const view = await getDomainProfileManifestView(projectId);
  const publishedManifest = view ? getPublishedManifestFromView(view) : null;

  return buildReportBranding({
    savedBrandLabel: clientBrand.brandLabel,
    publishedManifestLabel: publishedManifest?.name ?? null,
    primaryUrl: clientBrand.primaryUrl ?? clientBrand.projectDomain,
    agencyName: workspace?.name?.trim() || 'Agency',
    reportLogoUrl: workspace?.reportLogoUrl ?? null,
    brandPrimaryColor: workspace?.brandPrimaryColor ?? '#059669',
    hasPendingDraft: view?.hasPendingDraft ?? false,
    isManifestPublished: Boolean(view?.published),
  });
}

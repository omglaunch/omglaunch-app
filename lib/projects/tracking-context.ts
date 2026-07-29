import { getPrisma } from '@/lib/prisma';

export type ProjectTrackingContext = {
  id: string;
  domain: string | null;
  locationCode: number;
  languageCode: string;
  deviceType: 'desktop' | 'mobile';
  searchEngine: 'google_organic' | 'google_maps';
};

const DEFAULT_LOCATION_CODE = 2458;
const DEFAULT_LANGUAGE_CODE = 'en';

export async function getProjectTrackingContext(
  projectId: string,
  workspaceId: string
): Promise<ProjectTrackingContext | null> {
  const project = await getPrisma().project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      keywords: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          locationCode: true,
          languageCode: true,
          device: true,
          searchEngine: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const latest = project.keywords[0];
  const device = latest?.device?.trim().toLowerCase() === 'mobile' ? 'mobile' : 'desktop';
  const searchEngine =
    latest?.searchEngine?.trim().toLowerCase() === 'google_maps'
      ? 'google_maps'
      : 'google_organic';

  return {
    id: project.id,
    domain: project.domain,
    locationCode:
      typeof latest?.locationCode === 'number' && Number.isFinite(latest.locationCode)
        ? Math.trunc(latest.locationCode)
        : DEFAULT_LOCATION_CODE,
    languageCode: latest?.languageCode?.trim() || DEFAULT_LANGUAGE_CODE,
    deviceType: device,
    searchEngine,
  };
}

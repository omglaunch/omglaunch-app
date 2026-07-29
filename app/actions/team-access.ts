'use server';

import type { TeamRole } from '@/lib/settings/constants';
import {
  canWriteTeamRole,
  resolveTeamAccess,
} from '@/lib/projects/team-access';
import { requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { getPrisma } from '@/lib/prisma';

export type ClientTeamAccess = {
  role: TeamRole;
  isViewer: boolean;
  canWrite: boolean;
  isWorkspaceOwner: boolean;
  assignedProjectIds: string[];
  hideApiCostsFromViewer: boolean;
  hideUsageMetricsFromViewer: boolean;
  agencyName: string;
  reportLogoUrl: string | null;
  brandPrimaryColor: string;
};

/** Client-safe team access context for portal UI adaptation. */
export async function getClientTeamAccess(): Promise<ClientTeamAccess> {
  const access = await resolveTeamAccess();
  const workspaceId = await requireWorkspaceId();

  const workspace = await getPrisma().workspaceSettings.findFirst({
    where: { workspaceId },
    select: {
      name: true,
      hideApiCostsFromViewer: true,
      hideUsageMetricsFromViewer: true,
      reportLogoUrl: true,
      brandPrimaryColor: true,
    },
  });

  const isViewer = !access.isWorkspaceOwner && access.role === 'VIEWER';

  return {
    role: access.role,
    isViewer,
    canWrite: canWriteTeamRole(access.role) || access.isWorkspaceOwner,
    isWorkspaceOwner: access.isWorkspaceOwner,
    assignedProjectIds: access.assignedProjectIds,
    hideApiCostsFromViewer: workspace?.hideApiCostsFromViewer ?? true,
    hideUsageMetricsFromViewer: workspace?.hideUsageMetricsFromViewer ?? true,
    agencyName: workspace?.name?.trim() || 'Agency',
    reportLogoUrl: workspace?.reportLogoUrl ?? null,
    brandPrimaryColor: workspace?.brandPrimaryColor ?? '#059669',
  };
}

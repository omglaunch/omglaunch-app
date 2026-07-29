import { cookies } from 'next/headers';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import { ACTIVE_PROJECT_STORAGE_KEY } from '@/lib/projects/constants';
import {
  assertProjectAccess,
  canAccessProject,
  resolveTeamAccess,
} from '@/lib/projects/team-access';
import { getClientBrandForProject } from '@/lib/projects/client-brand';
import { getPrisma } from '@/lib/prisma';

export async function getServerActiveProjectId(): Promise<string | null> {
  const workspaceId = await getAuthenticatedWorkspaceId();
  const access = await resolveTeamAccess();
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_PROJECT_STORAGE_KEY)?.value;

  if (raw?.trim()) {
    const projectId = decodeURIComponent(raw.trim());
    const owned = await getPrisma().project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });

    if (owned && canAccessProject(access, projectId)) {
      return owned.id;
    }
  }

  if (!access.isWorkspaceOwner && access.role === 'VIEWER') {
    const allowed = access.assignedProjectIds.filter(Boolean);
    if (allowed.length > 0) {
      return allowed[0];
    }
    return null;
  }

  const fallback = await getPrisma().project.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return fallback?.id ?? null;
}

export async function getServerActiveProject() {
  const workspaceId = await getAuthenticatedWorkspaceId();
  const projectId = await getServerActiveProjectId();
  if (!projectId) return null;

  await assertProjectAccess(projectId);

  return getPrisma().project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      name: true,
      domain: true,
      keywords: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { location: true, language: true },
      },
    },
  });
}

export async function getServerActiveClientBrand() {
  const workspaceId = await getAuthenticatedWorkspaceId();
  const projectId = await getServerActiveProjectId();
  if (!projectId) return null;

  return getClientBrandForProject(projectId, workspaceId);
}

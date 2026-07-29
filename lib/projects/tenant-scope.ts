import type { Prisma } from '@prisma/client';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import {
  resolveProjectIdFromSources,
  type ProjectScopeSources,
} from '@/lib/projects/project-scope';
import { runWithTenantScopeAsync } from '@/lib/prisma/tenant-context';
import { getPrisma } from '@/lib/prisma';

export async function requireWorkspaceId(): Promise<string> {
  return getAuthenticatedWorkspaceId();
}

export async function runWithAuthenticatedTenantScope<T>(
  fn: () => Promise<T>
): Promise<T> {
  const workspaceId = await requireWorkspaceId();
  return runWithTenantScopeAsync(workspaceId, fn);
}

export async function getOwnedProject(
  projectId: string,
  workspaceId: string
) {
  return getPrisma().project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true, domain: true },
  });
}

export async function assertOwnedProject(projectId: string, workspaceId: string) {
  const project = await getOwnedProject(projectId, workspaceId);
  if (!project) {
    throw new Error('Project not found or access denied.');
  }
  return project;
}

export async function requireOwnedProjectId(
  projectId: string | null | undefined
): Promise<string> {
  const trimmed = projectId?.trim();
  if (!trimmed) {
    throw new Error('projectId is required');
  }

  const workspaceId = await requireWorkspaceId();
  await assertOwnedProject(trimmed, workspaceId);
  return trimmed;
}

export async function requireOwnedProjectFromSources(
  sources: ProjectScopeSources
): Promise<string> {
  return requireOwnedProjectId(resolveProjectIdFromSources(sources));
}

export async function resolveOwnedProjectFromSources(
  sources: ProjectScopeSources
): Promise<string | null> {
  const projectId = resolveProjectIdFromSources(sources);
  if (!projectId) {
    return null;
  }

  const workspaceId = await requireWorkspaceId();
  await assertOwnedProject(projectId, workspaceId);
  return projectId;
}

export {
  isProjectIdRequiredError,
  isTenantAccessDeniedError,
  isUnauthenticatedError,
  resolveProjectIdFromSources,
  type ProjectScopeSources,
} from '@/lib/projects/project-scope';

export async function listSavedKeywordsForProject(
  projectId: string,
  workspaceId: string,
  include?: Prisma.SavedKeywordInclude
) {
  return getPrisma().savedKeyword.findMany({
    where: { projectId, workspaceId },
    include,
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateSavedKeywordInWorkspace(
  id: string,
  workspaceId: string,
  data: Prisma.SavedKeywordUpdateInput
) {
  const result = await getPrisma().savedKeyword.updateMany({
    where: { id, workspaceId },
    data,
  });

  if (result.count === 0) {
    throw new Error('Keyword not found or access denied.');
  }
}

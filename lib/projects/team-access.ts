import type { TeamRole } from '@/lib/settings/constants';
import { TEAM_ROLES } from '@/lib/settings/constants';
import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import {
  resolveProjectIdFromSources,
  type ProjectScopeSources,
} from '@/lib/projects/project-scope';
import { assertOwnedProject, requireOwnedProjectId, requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { getPrisma } from '@/lib/prisma';

export class ProjectAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectAccessError';
  }
}

export class ReadOnlyAccessError extends Error {
  constructor(message = 'Client/Viewer accounts have read-only access.') {
    super(message);
    this.name = 'ReadOnlyAccessError';
  }
}

export type TeamAccessContext = {
  workspaceId: string;
  userId: string;
  email: string;
  role: TeamRole;
  assignedProjectIds: string[];
  isWorkspaceOwner: boolean;
};

function parseAssignedProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeRole(value: string | null | undefined): TeamRole {
  const upper = value?.trim().toUpperCase();
  if (upper && (TEAM_ROLES as readonly string[]).includes(upper)) {
    return upper as TeamRole;
  }
  return 'VIEWER';
}

export async function resolveTeamAccess(): Promise<TeamAccessContext> {
  const session = await getAuthenticatedSession();
  if (!session?.user?.id || !session.user.email) {
    throw new ProjectAccessError('Unauthenticated');
  }

  const workspaceId = await requireWorkspaceId();
  const userId = session.user.id;
  const email = session.user.email.trim().toLowerCase();
  const isWorkspaceOwner = userId === workspaceId;

  if (isWorkspaceOwner) {
    return {
      workspaceId,
      userId,
      email,
      role: 'OWNER',
      assignedProjectIds: [],
      isWorkspaceOwner: true,
    };
  }

  const member = await getPrisma().teamMember.findFirst({
    where: {
      workspaceId,
      OR: [{ userId }, { email }],
      status: 'active',
    },
    select: {
      role: true,
      assignedProjectIds: true,
    },
  });

  if (!member) {
    throw new ProjectAccessError('You do not have access to this workspace.');
  }

  return {
    workspaceId,
    userId,
    email,
    role: normalizeRole(member.role),
    assignedProjectIds: parseAssignedProjectIds(member.assignedProjectIds),
    isWorkspaceOwner: false,
  };
}

export function canWriteTeamRole(role: TeamRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR';
}

export async function assertWorkspaceWriteAccess(): Promise<TeamAccessContext> {
  const access = await resolveTeamAccess();
  if (!canWriteTeamRole(access.role)) {
    throw new ReadOnlyAccessError();
  }
  return access;
}

export function isProjectAccessError(error: unknown): error is ProjectAccessError | ReadOnlyAccessError {
  return error instanceof ProjectAccessError || error instanceof ReadOnlyAccessError;
}

export function canAccessProject(
  access: TeamAccessContext,
  projectId: string
): boolean {
  if (access.isWorkspaceOwner || access.role !== 'VIEWER') {
    return true;
  }
  return access.assignedProjectIds.includes(projectId);
}

export async function assertProjectAccess(projectId: string): Promise<TeamAccessContext> {
  const access = await resolveTeamAccess();
  await assertOwnedProject(projectId, access.workspaceId);

  if (!canAccessProject(access, projectId)) {
    throw new ProjectAccessError('You do not have access to this client project.');
  }

  return access;
}

export async function assertProjectWriteAccess(projectId: string): Promise<TeamAccessContext> {
  const access = await assertProjectAccess(projectId);

  if (!canWriteTeamRole(access.role)) {
    throw new ReadOnlyAccessError();
  }

  return access;
}

export async function filterProjectsForAccess<T extends { id: string }>(
  projects: T[]
): Promise<T[]> {
  const access = await resolveTeamAccess();

  if (access.isWorkspaceOwner || access.role !== 'VIEWER') {
    return projects;
  }

  const allowed = new Set(access.assignedProjectIds);
  return projects.filter(project => allowed.has(project.id));
}

/** Workspace ownership + viewer project allowlist (read). */
export async function requireAccessibleProjectId(
  projectId: string | null | undefined
): Promise<string> {
  const id = await requireOwnedProjectId(projectId);
  await assertProjectAccess(id);
  return id;
}

/** Workspace ownership + viewer project allowlist + write role (mutations). */
export async function requireAccessibleProjectWriteId(
  projectId: string | null | undefined
): Promise<string> {
  const id = await requireOwnedProjectId(projectId);
  await assertProjectWriteAccess(id);
  return id;
}

/** Read access from projectId / legacy scope sources. */
export async function requireAccessibleProjectFromSources(
  sources: ProjectScopeSources
): Promise<string> {
  const projectId = await resolveAccessibleProjectIdFromSourcesInternal(sources);
  if (!projectId) {
    throw new ProjectAccessError('projectId is required');
  }
  return projectId;
}

export async function resolveAccessibleProjectFromSources(
  sources: ProjectScopeSources
): Promise<string | null> {
  return resolveAccessibleProjectIdFromSourcesInternal(sources);
}

async function resolveAccessibleProjectIdFromSourcesInternal(
  sources: ProjectScopeSources
): Promise<string | null> {
  const explicitProjectId = sources.projectId?.trim();
  if (explicitProjectId) {
    return requireAccessibleProjectId(explicitProjectId);
  }

  const access = await resolveTeamAccess();
  const isViewer = !access.isWorkspaceOwner && access.role === 'VIEWER';

  // Viewers must never resolve scope via legacy workspaceId/campaignId aliases.
  if (isViewer) {
    if (access.assignedProjectIds.length === 1) {
      return requireAccessibleProjectId(access.assignedProjectIds[0]);
    }
    return null;
  }

  const legacyId = sources.workspaceId?.trim() || sources.campaignId?.trim();
  if (legacyId) {
    return requireAccessibleProjectId(legacyId);
  }

  return null;
}

/** Write access from projectId / legacy scope sources. */
export async function requireAccessibleProjectWriteFromSources(
  sources: ProjectScopeSources
): Promise<string> {
  const projectId = await resolveAccessibleProjectWriteIdFromSourcesInternal(sources);
  if (!projectId) {
    throw new ProjectAccessError('projectId is required');
  }
  return projectId;
}

export async function resolveAccessibleProjectWriteFromSources(
  sources: ProjectScopeSources
): Promise<string | null> {
  return resolveAccessibleProjectWriteIdFromSourcesInternal(sources);
}

async function resolveAccessibleProjectWriteIdFromSourcesInternal(
  sources: ProjectScopeSources
): Promise<string | null> {
  const explicitProjectId = sources.projectId?.trim();
  if (explicitProjectId) {
    return requireAccessibleProjectWriteId(explicitProjectId);
  }

  const access = await resolveTeamAccess();
  const isViewer = !access.isWorkspaceOwner && access.role === 'VIEWER';

  if (isViewer) {
    if (access.assignedProjectIds.length === 1) {
      return requireAccessibleProjectWriteId(access.assignedProjectIds[0]);
    }
    return null;
  }

  const legacyId = sources.workspaceId?.trim() || sources.campaignId?.trim();
  if (legacyId) {
    return requireAccessibleProjectWriteId(legacyId);
  }

  return null;
}

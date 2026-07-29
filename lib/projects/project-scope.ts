export type ProjectScopeSources = {
  projectId?: string | null;
  workspaceId?: string | null;
  campaignId?: string | null;
};

export function resolveProjectIdFromSources(
  sources: ProjectScopeSources
): string | null {
  // Legacy: `workspaceId` and `campaignId` were aliases for projectId before project scoping.
  // Prefer explicit `projectId`. Viewer-safe resolution lives in team-access.ts.
  return (
    sources.projectId?.trim() ||
    sources.workspaceId?.trim() ||
    sources.campaignId?.trim() ||
    null
  );
}

export function isTenantAccessDeniedError(message: string): boolean {
  return message === 'Project not found or access denied.';
}

export function isProjectIdRequiredError(message: string): boolean {
  return message === 'projectId is required';
}

export { isUnauthenticatedError, UnauthenticatedError } from '@/lib/projects/auth-errors';

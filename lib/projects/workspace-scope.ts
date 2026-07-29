/** Resolve project scope from API query/body fields (supports legacy naming). */
export function resolveProjectId(sources: {
  workspaceId?: string | null;
  projectId?: string | null;
  campaignId?: string | null;
}): string | null {
  const id =
    sources.projectId?.trim() ||
    sources.workspaceId?.trim() ||
    sources.campaignId?.trim();
  return id || null;
}

/** @deprecated Use resolveProjectId */
export const resolveWorkspaceId = resolveProjectId;

export function requireProjectId(
  id: string | null | undefined,
  label = 'projectId'
): string {
  const trimmed = id?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

/** @deprecated Use requireProjectId */
export const requireWorkspaceId = requireProjectId;

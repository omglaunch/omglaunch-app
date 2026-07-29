'use client';

import { useQuery } from '@tanstack/react-query';
import { useProject } from '@/components/projects/ProjectProvider';

export type WorkspaceDomainPreview = {
  projectId: string;
  brandName: string;
  website: string;
  description: string;
  status: 'PUBLISHED' | 'DRAFT_PENDING';
  hasPendingDraft: boolean;
  manifest: Record<string, unknown> | null;
  manifestVersion: number;
  draftManifest: Record<string, unknown> | null;
  draftVersion: number;
  draftUpdatedAt: string | null;
  publishedManifest: Record<string, unknown> | null;
  publishedVersion: number;
  publishedAt: string | null;
};

async function fetchWorkspaceDomainPreview(
  projectId: string
): Promise<WorkspaceDomainPreview> {
  const params = new URLSearchParams({ projectId });
  const response = await fetch(`/api/article-studio/workspace-context?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to load client domain context');
  }
  return response.json() as Promise<WorkspaceDomainPreview>;
}

export function useWorkspaceDomainPreview() {
  const { activeProjectId } = useProject();

  return useQuery({
    queryKey: ['workspace-domain-preview', activeProjectId],
    queryFn: () => fetchWorkspaceDomainPreview(activeProjectId),
    enabled: Boolean(activeProjectId?.trim()),
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import type { VisibilityGapHydration } from '@/lib/ai-visibility/types';

async function fetchVisibilityGap(
  promptId: string,
  projectId: string
): Promise<VisibilityGapHydration> {
  const params = new URLSearchParams({ projectId });
  const response = await fetch(
    `/api/ai-visibility/gap/${encodeURIComponent(promptId)}?${params.toString()}`
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'Failed to load visibility gap');
  }

  return response.json() as Promise<VisibilityGapHydration>;
}

export function useVisibilityGap(promptId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ['visibility-gap', projectId, promptId],
    queryFn: () => fetchVisibilityGap(promptId!, projectId!),
    enabled: Boolean(promptId?.trim() && projectId?.trim()),
    staleTime: 60_000,
    retry: 1,
  });
}

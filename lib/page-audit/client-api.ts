import type { RecentPageAudit } from '@/lib/page-audit/types';

export type SavePageAuditRequest = {
  url: string;
  targetKeyword: string;
  workspaceId: string;
};

export type SavedPageAuditResponse = {
  id: number;
  url: string;
  targetKeyword: string;
  geoScore: number;
  createdAt: string;
  auditData: unknown;
};

export async function savePageAuditViaApi(
  data: SavePageAuditRequest
): Promise<SavedPageAuditResponse> {
  if (!data.workspaceId.trim()) {
    throw new Error('workspaceId is required to save a page audit');
  }

  const response = await fetch('/api/page-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save page audit');
  }

  return response.json() as Promise<SavedPageAuditResponse>;
}

export async function fetchRecentPageAudits(workspaceId: string): Promise<RecentPageAudit[]> {
  if (!workspaceId.trim()) {
    return [];
  }

  const params = new URLSearchParams({ workspaceId: workspaceId.trim() });
  const response = await fetch(`/api/page-audit?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load page audits');
  }

  const payload = (await response.json()) as { audits: RecentPageAudit[] };
  return payload.audits.map(audit => ({
    ...audit,
    createdAt: new Date(audit.createdAt),
  }));
}

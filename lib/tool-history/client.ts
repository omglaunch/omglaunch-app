import type {
  MigrateToolHistoryInput,
  SaveToolHistoryInput,
  ToolHistoryEntry,
  ToolHistorySummary,
  ToolSlug,
  UpdateToolHistoryInput,
} from '@/lib/tool-history/types';

type ToolHistoryRequestOptions = {
  workspaceId: string;
  limit?: number;
};

function buildQuery(options: ToolHistoryRequestOptions): string {
  const params = new URLSearchParams();
  params.set('workspaceId', options.workspaceId.trim());
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  return `?${params.toString()}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchToolHistoryList(
  tool: ToolSlug,
  options: ToolHistoryRequestOptions
): Promise<ToolHistorySummary[]> {
  if (!options.workspaceId.trim()) {
    return [];
  }

  const response = await fetch(
    `/api/tool-history/${tool}${buildQuery(options)}`,
    { cache: 'no-store' }
  );
  const payload = await parseJsonResponse<{ entries: ToolHistorySummary[] }>(response);
  return payload.entries;
}

export async function fetchToolHistoryEntry(
  tool: ToolSlug,
  id: string,
  workspaceId: string
): Promise<ToolHistoryEntry> {
  if (!workspaceId.trim()) {
    throw new Error('workspaceId is required');
  }

  const query = `?workspaceId=${encodeURIComponent(workspaceId.trim())}`;
  const response = await fetch(`/api/tool-history/${tool}/${id}${query}`, {
    cache: 'no-store',
  });
  const payload = await parseJsonResponse<{ entry: ToolHistoryEntry }>(response);
  return payload.entry;
}

export async function fetchLatestToolHistoryByIdentifier(
  tool: ToolSlug,
  identifier: string,
  workspaceId: string
): Promise<ToolHistoryEntry | null> {
  if (!workspaceId.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    identifier,
    workspaceId: workspaceId.trim(),
  });
  const response = await fetch(`/api/tool-history/${tool}?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = await parseJsonResponse<{ entry: ToolHistoryEntry | null }>(response);
  return payload.entry;
}

export async function saveToolHistoryEntry(
  tool: ToolSlug,
  input: SaveToolHistoryInput
): Promise<ToolHistoryEntry> {
  if (!input.workspaceId?.trim()) {
    throw new Error('workspaceId is required');
  }

  const response = await fetch(`/api/tool-history/${tool}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJsonResponse<{ entry: ToolHistoryEntry }>(response);
  return payload.entry;
}

export async function updateToolHistoryEntry(
  tool: ToolSlug,
  id: string,
  input: UpdateToolHistoryInput
): Promise<ToolHistoryEntry> {
  if (!input.workspaceId?.trim()) {
    throw new Error('workspaceId is required');
  }

  const response = await fetch(`/api/tool-history/${tool}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJsonResponse<{ entry: ToolHistoryEntry }>(response);
  return payload.entry;
}

export async function deleteToolHistoryEntry(
  tool: ToolSlug,
  id: string,
  workspaceId: string
): Promise<void> {
  if (!workspaceId.trim()) {
    throw new Error('workspaceId is required');
  }

  const query = `?workspaceId=${encodeURIComponent(workspaceId.trim())}`;
  const response = await fetch(`/api/tool-history/${tool}/${id}${query}`, {
    method: 'DELETE',
  });
  await parseJsonResponse<{ success: boolean }>(response);
}

export async function migrateToolHistoryFromClient(
  tool: ToolSlug,
  input: MigrateToolHistoryInput
): Promise<number> {
  if (!input.workspaceId?.trim()) {
    throw new Error('workspaceId is required');
  }

  const response = await fetch(`/api/tool-history/${tool}/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJsonResponse<{ imported: number }>(response);
  return payload.imported;
}

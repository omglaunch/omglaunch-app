import {
  fetchLatestToolHistoryByIdentifier,
  saveToolHistoryEntry,
} from '@/lib/tool-history/client';
import {
  buildAnalysisIdentifier,
  buildSemanticIdentifier,
} from '@/lib/tool-history/import-local';
import type { ToolSlug } from '@/lib/tool-history/types';

type StoredAnalysisPayload<T> = {
  data: T;
  url: string;
  keyword: string;
  timestamp: number;
};

function isStoredAnalysisPayload<T>(
  value: unknown,
  validate: (data: unknown) => data is T
): value is StoredAnalysisPayload<T> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as StoredAnalysisPayload<T>;
  return (
    validate(payload.data) &&
    typeof payload.url === 'string' &&
    typeof payload.keyword === 'string' &&
    typeof payload.timestamp === 'number'
  );
}

export async function loadLatestAnalysisFromHistory<T>(options: {
  tool: ToolSlug;
  identifier: string;
  validate: (data: unknown) => data is T;
  workspaceId?: string;
}): Promise<{
  data: T;
  timestamp: number;
  historyId: string;
  url: string;
  keyword: string;
} | null> {
  if (!options.workspaceId?.trim()) {
    return null;
  }

  const entry = await fetchLatestToolHistoryByIdentifier(
    options.tool,
    options.identifier,
    options.workspaceId
  );
  if (!entry) {
    return null;
  }

  if (!isStoredAnalysisPayload(entry.resultData, options.validate)) {
    return null;
  }

  return {
    data: entry.resultData.data,
    timestamp: entry.resultData.timestamp,
    historyId: entry.id,
    url: entry.resultData.url,
    keyword: entry.resultData.keyword,
  };
}

export async function persistAnalysisToHistory<T>(options: {
  tool: ToolSlug;
  identifier: string;
  data: T;
  url: string;
  keyword?: string;
  workspaceId?: string;
  id?: string;
}): Promise<string> {
  const entry = await saveToolHistoryEntry(options.tool, {
    id: options.id,
    identifier: options.identifier,
    workspaceId: options.workspaceId,
    resultData: {
      data: options.data,
      url: options.url,
      keyword: options.keyword ?? '',
      timestamp: Date.now(),
      ...(options.workspaceId ? { projectId: options.workspaceId } : {}),
    },
  });

  return entry.id;
}

export { buildAnalysisIdentifier, buildSemanticIdentifier };

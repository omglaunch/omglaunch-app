'use client';

import { useCallback, useEffect, useState } from 'react';
import { useProjectId } from '@/components/projects/ProjectProvider';
import {
  deleteToolHistoryEntry,
  fetchToolHistoryEntry,
  fetchToolHistoryList,
  saveToolHistoryEntry,
} from '@/lib/tool-history/client';
import { importLocalHistoryIfNeeded } from '@/lib/tool-history/import-local';
import type {
  SaveToolHistoryInput,
  ToolHistoryEntry,
  ToolHistorySummary,
  ToolSlug,
} from '@/lib/tool-history/types';

type UseToolHistoryOptions = {
  limit?: number;
  importLocal?: boolean;
  /** Explicit project scope — defaults to active project from context. */
  workspaceId?: string;
  projectId?: string;
};

export function useToolHistory(tool: ToolSlug, options?: UseToolHistoryOptions) {
  const contextProjectId = useProjectId();
  const projectId =
    options?.projectId?.trim() ||
    options?.workspaceId?.trim() ||
    contextProjectId?.trim() ||
    '';
  const [entries, setEntries] = useState<ToolHistorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const limit = options?.limit ?? 50;
  const shouldImportLocal = options?.importLocal ?? false;

  const refresh = useCallback(async () => {
    if (!projectId.trim()) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextEntries = await fetchToolHistoryList(tool, {
        limit,
        workspaceId: projectId,
      });
      setEntries(nextEntries);
    } finally {
      setIsLoading(false);
    }
  }, [limit, projectId, tool]);

  useEffect(() => {
    setEntries([]);
    setActiveId(null);
    setIsLoading(true);

    if (!projectId.trim()) {
      setIsLoading(false);
      return;
    }

    void (async () => {
      if (shouldImportLocal) {
        await importLocalHistoryIfNeeded(tool, projectId);
      }
      await refresh();
    })();
  }, [projectId, refresh, shouldImportLocal, tool]);

  const save = useCallback(
    async (input: SaveToolHistoryInput): Promise<ToolHistoryEntry> => {
      if (!projectId.trim()) {
        throw new Error('Active project is required to save history');
      }

      const entry = await saveToolHistoryEntry(tool, {
        ...input,
        workspaceId: projectId,
      });
      setActiveId(entry.id);
      await refresh();
      return entry;
    },
    [projectId, refresh, tool]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!projectId.trim()) {
        return;
      }

      await deleteToolHistoryEntry(tool, id, projectId);
      if (activeId === id) {
        setActiveId(null);
      }
      await refresh();
    },
    [activeId, projectId, refresh, tool]
  );

  const loadEntry = useCallback(
    async (id: string): Promise<ToolHistoryEntry> => {
      if (!projectId.trim()) {
        throw new Error('Active project is required to load history');
      }

      const entry = await fetchToolHistoryEntry(tool, id, projectId);
      setActiveId(entry.id);
      return entry;
    },
    [projectId, tool]
  );

  return {
    entries,
    isLoading,
    activeId,
    setActiveId,
    save,
    remove,
    refresh,
    loadEntry,
  };
}

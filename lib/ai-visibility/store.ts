'use client';

/**
 * Centralized visibility store (Zustand-equivalent with useSyncExternalStore).
 * SSE/WS payloads mutate by prompt_id only and must pass sequence timestamp checks.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { VisibilityRow } from '@/lib/ai-visibility/types';

type VisibilityStoreState = {
  rowsById: Record<string, VisibilityRow>;
  /** Sort index frozen until manual refresh — SSE must not reshuffle */
  sortIndex: string[];
  lastUpdatedAt: string | null;
  hydrated: boolean;
};

type Listener = () => void;

let state: VisibilityStoreState = {
  rowsById: {},
  sortIndex: [],
  lastUpdatedAt: null,
  hydrated: false,
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function getVisibilityStoreSnapshot(): VisibilityStoreState {
  return state;
}

export function subscribeVisibilityStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVisibilityStore<T>(
  selector: (s: VisibilityStoreState) => T
): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cacheRef = useRef<{ state: VisibilityStoreState; selection: T } | null>(
    null
  );

  const getSelection = useCallback(() => {
    const current = state;
    const cache = cacheRef.current;
    if (cache && cache.state === current) {
      return cache.selection;
    }
    const selection = selectorRef.current(current);
    cacheRef.current = { state: current, selection };
    return selection;
  }, []);

  return useSyncExternalStore(
    subscribeVisibilityStore,
    getSelection,
    getSelection
  );
}

export function replaceVisibilityRows(
  rows: VisibilityRow[],
  lastUpdatedAt: string,
  opts?: { preserveSort?: boolean }
) {
  const rowsById: Record<string, VisibilityRow> = {};
  for (const row of rows) rowsById[row.promptId] = row;
  const sortIndex =
    opts?.preserveSort && state.sortIndex.length > 0
      ? [
          ...state.sortIndex.filter((id) => rowsById[id]),
          ...rows.map((r) => r.promptId).filter((id) => !state.sortIndex.includes(id)),
        ]
      : rows.map((r) => r.promptId);

  state = {
    rowsById,
    sortIndex,
    lastUpdatedAt,
    hydrated: true,
  };
  emit();
}

export function mergeVisibilityRows(
  rows: VisibilityRow[],
  lastUpdatedAt: string,
  opts?: { prepend?: boolean }
) {
  const rowsById = { ...state.rowsById };
  const sortIndex = [...state.sortIndex];
  for (const row of rows) {
    rowsById[row.promptId] = row;
    if (!sortIndex.includes(row.promptId)) {
      if (opts?.prepend) sortIndex.unshift(row.promptId);
      else sortIndex.push(row.promptId);
    }
  }
  state = {
    rowsById,
    sortIndex,
    lastUpdatedAt,
    hydrated: true,
  };
  emit();
}

/**
 * SSE mutation — ONLY by prompt_id. Accept only if payload.updated_at > local last_action_at.
 * Live updates alter visual cell state but MUST NOT change sortIndex (optimistic freeze).
 */
export function applySseRowPatch(
  promptId: string,
  patch: Partial<VisibilityRow> & { updatedAt: string }
): boolean {
  const existing = state.rowsById[promptId];
  if (!existing) return false;

  const localTs = Date.parse(existing.lastActionAt || existing.updatedAt);
  const incomingTs = Date.parse(patch.updatedAt);
  if (!Number.isFinite(incomingTs) || incomingTs <= localTs) {
    return false; // stale — reject flicker
  }

  state = {
    ...state,
    rowsById: {
      ...state.rowsById,
      [promptId]: {
        ...existing,
        ...patch,
        promptId, // never allow PK mutation to a different id
        updatedAt: patch.updatedAt,
      },
    },
    // sortIndex intentionally untouched
  };
  emit();
  return true;
}

export function patchVisibilityRow(
  promptId: string,
  patch: Partial<VisibilityRow>
) {
  const existing = state.rowsById[promptId];
  if (!existing) return;
  const now = new Date().toISOString();
  state = {
    ...state,
    rowsById: {
      ...state.rowsById,
      [promptId]: {
        ...existing,
        ...patch,
        promptId,
        lastActionAt: now,
        updatedAt: now,
      },
    },
  };
  emit();
}

export function getOrderedRows(): VisibilityRow[] {
  return state.sortIndex
    .map((id) => state.rowsById[id])
    .filter((r): r is VisibilityRow => Boolean(r));
}

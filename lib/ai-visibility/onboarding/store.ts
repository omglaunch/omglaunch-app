'use client';

/**
 * Prompt Onboarding staging store (Zustand-equivalent).
 * Staging sits ABOVE tab lifecycle. Unified Append uses PrevState pattern.
 * UUIDs minted at ingestion — never during React render.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  CAPACITY_REACHED_MESSAGE,
  remainingStagingSlots,
  resolveCapacityCeiling,
} from './capacity';
import type {
  BulkEditPatch,
  GeoTargetOption,
  OnboardingSource,
  StagingPromptRow,
  WorkspaceTrackingSettings,
} from './types';
import {
  FALLBACK_WORKSPACE_GEO,
  GLOBAL_GEO,
} from './types';
import {
  hasBlockingErrors,
  mintPromptUuid,
  normalizePromptString,
  recomputeRowErrors,
} from './utils';

type Listener = () => void;

type StagingState = {
  rowsById: Record<string, StagingPromptRow>;
  /** Stable insertion order for virtual table */
  order: string[];
  /** Checkbox memory — Map keyed by immutable UUID */
  selected: Map<string, boolean>;
  remainingAccountLimit: number;
  workspaceSettings: WorkspaceTrackingSettings | null;
  /** Discover / GSC ingest in flight */
  isIngesting: boolean;
  /** Bulk commit in flight */
  isCommitting: boolean;
  lastCapacityAlert: string | null;
  /** Pending prompt edits awaiting debounce flush */
  pendingPromptEdits: Map<string, string>;
  hydrated: boolean;
};

const DEFAULT_SETTINGS: WorkspaceTrackingSettings = {
  remainingAccountLimit: 100,
  activeDefaultEngines: 4,
  syncFrequencyMultiplier: 4.3, // weekly ≈ 4.3 syncs/mo
  defaultGeo: FALLBACK_WORKSPACE_GEO,
  creditsPerEngineSync: 1,
};

let state: StagingState = {
  rowsById: {},
  order: [],
  selected: new Map(),
  remainingAccountLimit: 100,
  workspaceSettings: null,
  isIngesting: false,
  isCommitting: false,
  lastCapacityAlert: null,
  pendingPromptEdits: new Map(),
  hydrated: false,
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function getOnboardingSnapshot(): StagingState {
  return state;
}

export function subscribeOnboarding(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Subscribe with stable snapshots. Selectors that allocate (e.g. map → array)
 * must not return a fresh reference on every getSnapshot call or React 18
 * useSyncExternalStore will infinite-loop via forceStoreRerender.
 */
export function useOnboardingStore<T>(selector: (s: StagingState) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const cacheRef = useRef<{ state: StagingState; selection: T } | null>(null);

  const getSelection = useCallback(() => {
    const current = state;
    const cache = cacheRef.current;
    // Same store revision → reuse prior selection (even if selector allocates)
    if (cache && cache.state === current) {
      return cache.selection;
    }
    const selection = selectorRef.current(current);
    cacheRef.current = { state: current, selection };
    return selection;
  }, []);

  return useSyncExternalStore(
    subscribeOnboarding,
    getSelection,
    getSelection
  );
}

/** Memoized-style derived selectors */
export function selectStagingRows(s: StagingState): StagingPromptRow[] {
  return s.order.map((id) => s.rowsById[id]!).filter(Boolean);
}

export function selectSelectedCount(s: StagingState): number {
  let n = 0;
  s.selected.forEach((v) => {
    if (v) n += 1;
  });
  return n;
}

export function selectSelectedActiveCount(s: StagingState): number {
  let n = 0;
  s.selected.forEach((v, id) => {
    if (!v) return;
    const row = s.rowsById[id];
    if (row && !hasBlockingErrors(row)) n += 1;
  });
  return n;
}

export function selectHasSelectedErrors(s: StagingState): boolean {
  for (const [id, v] of Array.from(s.selected.entries())) {
    if (!v) continue;
    const row = s.rowsById[id];
    if (row && hasBlockingErrors(row)) return true;
  }
  return false;
}

export function selectEstimatedMonthlyCredits(s: StagingState): number {
  const settings = s.workspaceSettings ?? DEFAULT_SETTINGS;
  const selected = selectSelectedActiveCount(s);
  return Math.round(
    selected *
      settings.activeDefaultEngines *
      settings.syncFrequencyMultiplier *
      settings.creditsPerEngineSync
  );
}

export function hydrateWorkspaceSettings(settings: WorkspaceTrackingSettings) {
  state = {
    ...state,
    workspaceSettings: settings,
    remainingAccountLimit: settings.remainingAccountLimit,
    hydrated: true,
  };
  emit();
}

/** Discover / GSC SSE ingest */
export function setOnboardingIngesting(isIngesting: boolean) {
  state = { ...state, isIngesting };
  emit();
}

/** Bulk commit to Visibility Engine */
export function setOnboardingCommitting(isCommitting: boolean) {
  state = { ...state, isCommitting };
  emit();
}

/** @deprecated Use setOnboardingIngesting — kept for any residual callers */
export function setOnboardingProcessing(isProcessing: boolean) {
  setOnboardingIngesting(isProcessing);
}

export function clearCapacityAlert() {
  if (!state.lastCapacityAlert) return;
  state = { ...state, lastCapacityAlert: null };
  emit();
}

type IngestDraft = {
  prompt: string;
  source: OnboardingSource;
  cluster?: string;
  geo?: GeoTargetOption | null;
  geoPending?: boolean;
};

/**
 * Unified Append — functional PrevState pattern.
 * Capacity: Math.min(100, remainingAccountLimit) − current rows.
 * Cross-source dedupe on normalized prompt string.
 */
export function appendStagingRows(drafts: IngestDraft[]): {
  appended: number;
  sliced: number;
  duplicatesSkipped: number;
  capacityHit: boolean;
} {
  // Functional update snapshot
  const prev = state;
  const defaultGeo =
    prev.workspaceSettings?.defaultGeo ?? FALLBACK_WORKSPACE_GEO;
  const remaining = remainingStagingSlots(
    prev.order.length,
    prev.remainingAccountLimit
  );

  if (remaining <= 0) {
    state = {
      ...prev,
      lastCapacityAlert: CAPACITY_REACHED_MESSAGE,
    };
    emit();
    return { appended: 0, sliced: drafts.length, duplicatesSkipped: 0, capacityHit: true };
  }

  const existingNorm = new Set(
    prev.order.map((id) => prev.rowsById[id]?.promptNormalized).filter(Boolean)
  );

  let duplicatesSkipped = 0;
  const accepted: StagingPromptRow[] = [];

  for (const draft of drafts) {
    if (accepted.length >= remaining) break;
    const prompt = draft.prompt.trim();
    if (!prompt) continue;
    const promptNormalized = normalizePromptString(prompt);
    if (existingNorm.has(promptNormalized)) {
      duplicatesSkipped += 1;
      continue;
    }
    // Also dedupe within this batch
    if (accepted.some((r) => r.promptNormalized === promptNormalized)) {
      duplicatesSkipped += 1;
      continue;
    }

    const geo = draft.geo === undefined ? defaultGeo : draft.geo;
    const row: StagingPromptRow = {
      id: mintPromptUuid(),
      prompt,
      promptNormalized,
      source: draft.source,
      cluster: draft.cluster?.trim() || 'Uncategorized',
      geo,
      geoPending: draft.geoPending ?? false,
      errors: [],
      createdAt: new Date().toISOString(),
    };
    row.errors = recomputeRowErrors(row);
    accepted.push(row);
    existingNorm.add(promptNormalized);
  }

  const sliced = Math.max(0, drafts.length - accepted.length - duplicatesSkipped);
  const capacityHit = remaining < drafts.length && accepted.length === remaining;

  const rowsById = { ...prev.rowsById };
  const order = [...prev.order];
  for (const row of accepted) {
    rowsById[row.id] = row;
    order.push(row.id);
  }

  state = {
    ...prev,
    rowsById,
    order,
    lastCapacityAlert: capacityHit ? CAPACITY_REACHED_MESSAGE : prev.lastCapacityAlert,
  };
  emit();

  return {
    appended: accepted.length,
    sliced: capacityHit ? sliced : 0,
    duplicatesSkipped,
    capacityHit,
  };
}

/** Debounced / onBlur sync from local input → store */
export function syncPromptText(id: string, prompt: string) {
  const prev = state;
  const existing = prev.rowsById[id];
  if (!existing) return;

  const nextPrompt = prompt;
  const promptNormalized = normalizePromptString(nextPrompt);
  const next: StagingPromptRow = {
    ...existing,
    prompt: nextPrompt,
    promptNormalized,
  };
  next.errors = recomputeRowErrors(next);

  const pending = new Map(prev.pendingPromptEdits);
  pending.delete(id);

  state = {
    ...prev,
    rowsById: { ...prev.rowsById, [id]: next },
    pendingPromptEdits: pending,
  };
  emit();
}

export function setPendingPromptEdit(id: string, prompt: string) {
  const pending = new Map(state.pendingPromptEdits);
  pending.set(id, prompt);
  state = { ...state, pendingPromptEdits: pending };
  // No emit — avoid table thrash; flush before commit
}

/** Flush pending debounced edits before Commit */
export function flushPendingPromptEdits() {
  const prev = state;
  if (prev.pendingPromptEdits.size === 0) return;
  const rowsById = { ...prev.rowsById };
  prev.pendingPromptEdits.forEach((prompt, id) => {
    const existing = rowsById[id];
    if (!existing) return;
    const next: StagingPromptRow = {
      ...existing,
      prompt,
      promptNormalized: normalizePromptString(prompt),
    };
    next.errors = recomputeRowErrors(next);
    rowsById[id] = next;
  });
  state = {
    ...prev,
    rowsById,
    pendingPromptEdits: new Map(),
  };
  emit();
}

export function updateStagingRow(
  id: string,
  patch: Partial<Pick<StagingPromptRow, 'cluster' | 'geo' | 'geoPending'>>
) {
  const prev = state;
  const existing = prev.rowsById[id];
  if (!existing) return;
  const next: StagingPromptRow = { ...existing, ...patch };
  next.errors = recomputeRowErrors(next);
  state = {
    ...prev,
    rowsById: { ...prev.rowsById, [id]: next },
  };
  emit();
}

export function bulkEditSelected(patch: BulkEditPatch) {
  const prev = state;
  const rowsById = { ...prev.rowsById };
  prev.selected.forEach((v, id) => {
    if (!v) return;
    const existing = rowsById[id];
    if (!existing || hasBlockingErrors(existing)) return;
    const next: StagingPromptRow = {
      ...existing,
      cluster: patch.cluster ?? existing.cluster,
      geo: patch.geo !== undefined ? patch.geo : existing.geo,
      geoPending: patch.geo ? false : existing.geoPending,
    };
    next.errors = recomputeRowErrors(next);
    rowsById[id] = next;
  });
  state = { ...prev, rowsById };
  emit();
}

export function toggleRowSelected(id: string) {
  const prev = state;
  const row = prev.rowsById[id];
  if (!row) return;
  // Refuse selecting rows with validation errors via individual still allowed?
  // Spec: Master checkbox refuses errors; individual can still be toggled but commit blocks.
  const selected = new Map(prev.selected);
  selected.set(id, !selected.get(id));
  state = { ...prev, selected };
  emit();
}

/**
 * Master checkbox — Conditional Filter Guard.
 * Explicitly refuses to select rows with validation/resolution errors.
 */
export function selectAllEligible(checked: boolean) {
  const prev = state;
  const selected = new Map(prev.selected);
  for (const id of prev.order) {
    const row = prev.rowsById[id];
    if (!row) continue;
    if (checked) {
      if (hasBlockingErrors(row)) {
        selected.set(id, false);
      } else {
        selected.set(id, true);
      }
    } else {
      selected.set(id, false);
    }
  }
  state = { ...prev, selected };
  emit();
}

export function clearStagingTable() {
  state = {
    ...state,
    rowsById: {},
    order: [],
    selected: new Map(),
    pendingPromptEdits: new Map(),
    lastCapacityAlert: null,
  };
  emit();
}

export function getSelectedRowsForCommit(): StagingPromptRow[] {
  flushPendingPromptEdits();
  const rows: StagingPromptRow[] = [];
  state.selected.forEach((v, id) => {
    if (!v) return;
    const row = state.rowsById[id];
    if (row && !hasBlockingErrors(row)) rows.push(row);
  });
  return rows;
}

export function getDefaultGeo(): GeoTargetOption {
  return state.workspaceSettings?.defaultGeo ?? FALLBACK_WORKSPACE_GEO;
}

export function getGlobalGeo(): GeoTargetOption {
  return GLOBAL_GEO;
}

export function getCeiling(): number {
  return resolveCapacityCeiling(state.remainingAccountLimit);
}

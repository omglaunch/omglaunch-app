'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'omglaunch-guided-tour';

export type TourPhase = 'dashboard' | 'hub-spoke';

export type TourState = {
  hasSeenTour: boolean;
  isTourActive: boolean;
  tourPhase: TourPhase | null;
};

const DEFAULT_STATE: TourState = {
  hasSeenTour: false,
  isTourActive: false,
  tourPhase: null,
};

type Listener = () => void;

const listeners = new Set<Listener>();

/** Cached snapshot so useSyncExternalStore getSnapshot stays referentially stable. */
let cachedSnapshot: TourState = DEFAULT_STATE;
let cachedStorageRaw: string | null = null;

function tourStatesEqual(a: TourState, b: TourState): boolean {
  return (
    a.hasSeenTour === b.hasSeenTour &&
    a.isTourActive === b.isTourActive &&
    a.tourPhase === b.tourPhase
  );
}

function parseTourState(raw: string | null): TourState {
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      hasSeenTour: Boolean(parsed.hasSeenTour),
      isTourActive: Boolean(parsed.isTourActive),
      tourPhase:
        parsed.tourPhase === 'dashboard' || parsed.tourPhase === 'hub-spoke'
          ? parsed.tourPhase
          : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function commitSnapshot(next: TourState, storageRaw: string | null): TourState {
  if (tourStatesEqual(cachedSnapshot, next)) {
    cachedStorageRaw = storageRaw;
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  cachedStorageRaw = storageRaw;
  return cachedSnapshot;
}

function readTourState(): TourState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedStorageRaw) {
    return cachedSnapshot;
  }

  return commitSnapshot(parseTourState(raw), raw);
}

function writeTourState(next: TourState): void {
  if (typeof window === 'undefined') {
    return;
  }

  const serialized = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  commitSnapshot(next, serialized);
  listeners.forEach((listener) => listener());
}

export function getTourState(): TourState {
  return readTourState();
}

export function startGuidedTour(): void {
  writeTourState({
    hasSeenTour: false,
    isTourActive: true,
    tourPhase: 'dashboard',
  });
}

export function advanceGuidedTourToHubSpoke(): void {
  const current = readTourState();
  writeTourState({
    ...current,
    isTourActive: true,
    tourPhase: 'hub-spoke',
  });
}

export function completeGuidedTour(): void {
  writeTourState({
    hasSeenTour: true,
    isTourActive: false,
    tourPhase: null,
  });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      cachedStorageRaw = null;
      listener();
    }
  }

  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function useTourState(): TourState {
  return useSyncExternalStore(subscribe, readTourState, () => DEFAULT_STATE);
}

'use client';

/**
 * Visibility-based SSE connection shedding — prevents multi-tab exhaustion
 * (browsers typically cap ~6 connections per origin).
 */

type SseHandler = (event: MessageEvent) => void;

let sharedSource: EventSource | null = null;
let refCount = 0;
const handlers = new Set<SseHandler>();

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // Shed connection when tab is backgrounded
    if (sharedSource) {
      sharedSource.close();
      sharedSource = null;
    }
  } else if (refCount > 0 && !sharedSource) {
    connect();
  }
}

function connect() {
  if (typeof window === 'undefined' || sharedSource) return;
  // Endpoint may be optional in local/dev — soft-fail
  try {
    sharedSource = new EventSource('/api/ai-visibility/stream');
    sharedSource.onmessage = (ev) => {
      handlers.forEach((h) => h(ev));
    };
    sharedSource.onerror = () => {
      // reconnect is handled on focus via reconcile hook
    };
  } catch {
    sharedSource = null;
  }
}

export function subscribeVisibilitySse(handler: SseHandler): () => void {
  handlers.add(handler);
  refCount += 1;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    connect();
  }

  return () => {
    handlers.delete(handler);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      sharedSource?.close();
      sharedSource = null;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    }
  };
}

/** Reconnection reconciliation — fetch delta on window focus. */
export function useFocusReconcile(onFocus: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    if (document.visibilityState === 'visible') onFocus();
  };
  window.addEventListener('focus', handler);
  document.addEventListener('visibilitychange', handler);
  return () => {
    window.removeEventListener('focus', handler);
    document.removeEventListener('visibilitychange', handler);
  };
}

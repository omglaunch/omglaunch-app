/**
 * Throttled SSE buffer flush (300ms) + Last-Event-ID recovery helpers.
 */

type FlushFn<T> = (batch: T[]) => void;

export function createThrottledBuffer<T>(flush: FlushFn<T>, intervalMs = 300) {
  let buffer: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (buffer.length === 0) return;
      const batch = buffer;
      buffer = [];
      flush(batch);
    }, intervalMs);
  }

  return {
    push(item: T) {
      buffer.push(item);
      schedule();
    },
    pushMany(items: T[]) {
      buffer.push(...items);
      schedule();
    },
    flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (buffer.length === 0) return;
      const batch = buffer;
      buffer = [];
      flush(batch);
    },
    clear() {
      buffer = [];
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export type SseHandlers = {
  onEvent: (event: string, data: string, lastEventId: string | null) => void;
  onError?: (err: Event) => void;
  onOpen?: () => void;
};

/**
 * SSE client with Last-Event-ID recovery.
 * Backend must emit keep-alive [ping] every 10s.
 */
export function connectResilientSse(
  url: string,
  handlers: SseHandlers,
  abort?: AbortSignal
): () => void {
  let lastEventId: string | null = null;
  let closed = false;
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function open() {
    if (closed) return;
    const sep = url.includes('?') ? '&' : '?';
    const full =
      lastEventId != null
        ? `${url}${sep}lastEventId=${encodeURIComponent(lastEventId)}`
        : url;
    source = new EventSource(full);

    source.onopen = () => handlers.onOpen?.();

    source.onmessage = (ev) => {
      if (ev.lastEventId) lastEventId = ev.lastEventId;
      handlers.onEvent('message', ev.data, lastEventId);
    };

    // Named events
    for (const name of ['ping', 'progress', 'prompts', 'done', 'error'] as const) {
      source.addEventListener(name, ((ev: MessageEvent) => {
        if (ev.lastEventId) lastEventId = ev.lastEventId;
        handlers.onEvent(name, String(ev.data ?? ''), lastEventId);
      }) as EventListener);
    }

    source.onerror = (err) => {
      handlers.onError?.(err);
      source?.close();
      source = null;
      if (!closed && !abort?.aborted) {
        retryTimer = setTimeout(open, 1500);
      }
    };
  }

  const onAbort = () => {
    closed = true;
    source?.close();
    if (retryTimer) clearTimeout(retryTimer);
  };
  abort?.addEventListener('abort', onAbort);

  open();

  return () => {
    closed = true;
    abort?.removeEventListener('abort', onAbort);
    source?.close();
    if (retryTimer) clearTimeout(retryTimer);
  };
}

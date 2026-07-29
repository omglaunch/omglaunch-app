import type { VisibilityActionPayload } from '@/lib/ai-visibility/types';
import {
  AI_VISIBILITY_AUTO_GENERATE_KEY,
  AI_VISIBILITY_PREFILL_KEY,
} from '@/lib/ai-visibility/types';

export function storeVisibilityPrefill(
  payload: VisibilityActionPayload,
  options?: { autoGenerate?: boolean }
): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(AI_VISIBILITY_PREFILL_KEY, JSON.stringify(payload));

  if (options?.autoGenerate) {
    sessionStorage.setItem(AI_VISIBILITY_AUTO_GENERATE_KEY, '1');
  }
}

export function consumeVisibilityPrefill(): VisibilityActionPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(AI_VISIBILITY_PREFILL_KEY);
    if (!raw) {
      return null;
    }
    sessionStorage.removeItem(AI_VISIBILITY_PREFILL_KEY);

    const parsed = JSON.parse(raw) as VisibilityActionPayload;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.promptId !== 'string' ||
      !parsed.promptId.trim()
    ) {
      return null;
    }

    return parsed;
  } catch {
    sessionStorage.removeItem(AI_VISIBILITY_PREFILL_KEY);
    return null;
  }
}

export function consumeAutoGenerateIntent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const intent = sessionStorage.getItem(AI_VISIBILITY_AUTO_GENERATE_KEY) === '1';
  sessionStorage.removeItem(AI_VISIBILITY_AUTO_GENERATE_KEY);
  return intent;
}

export function peekVisibilityPrefill(): VisibilityActionPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(AI_VISIBILITY_PREFILL_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as VisibilityActionPayload;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.promptId !== 'string' ||
      !parsed.promptId.trim()
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

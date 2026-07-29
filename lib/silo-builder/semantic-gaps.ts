import type { SemanticGap } from '@/lib/competitor-intel/types';

export type { SemanticGap };

export function parseSemanticGaps(value: unknown): SemanticGap[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is SemanticGap =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SemanticGap).topic === 'string' &&
      typeof (item as SemanticGap).rationale === 'string' &&
      ['high', 'medium', 'low'].includes((item as SemanticGap).priority)
  );
}

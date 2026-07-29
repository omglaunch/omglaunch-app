import type { VisibilityRow } from '@/lib/ai-visibility/types';

export function cleanBrandAlias(alias: string): string | null {
  const trimmed = alias.trim();
  if (!trimmed) return null;
  if (trimmed.includes('*') || trimmed.startsWith('/') || trimmed.includes('\\')) {
    return null;
  }
  return trimmed;
}

export type TrackedBrandContext = {
  brandLabel: string;
  brandWebsite: string;
  targetEntities: string[];
};

/**
 * Human-readable tracked brand from matrix aliases — never the workspace display name.
 * Prefers plain names (e.g. "OMG Launch") over domains or regex patterns.
 */
export function resolveTrackedBrandLabel(row: VisibilityRow): string {
  for (const alias of row.brandAliases) {
    const cleaned = cleanBrandAlias(alias);
    if (cleaned && !cleaned.includes('.')) {
      return cleaned;
    }
  }

  for (const alias of row.brandAliases) {
    const cleaned = cleanBrandAlias(alias);
    if (cleaned) {
      return cleaned;
    }
  }

  const website = row.userTargetUrl?.trim();
  if (website) {
    try {
      const host = new URL(website).hostname.replace(/^www\./, '');
      const segment = host.split('.')[0]?.trim();
      if (segment) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    } catch {
      // fall through
    }
  }

  return 'Tracked Brand';
}

export function resolveTrackedBrandWebsite(row: VisibilityRow): string {
  const url = row.userTargetUrl?.trim();
  if (!url) {
    return '';
  }

  try {
    new URL(url);
    return url;
  } catch {
    return '';
  }
}

/** Entities to optimize for AEO — tracked brand aliases + cited competitors only. */
export function deriveTargetEntitiesFromRow(row: VisibilityRow): string[] {
  const entities = new Set<string>();

  const brandLabel = resolveTrackedBrandLabel(row);
  if (brandLabel) {
    entities.add(brandLabel);
  }

  for (const alias of row.brandAliases) {
    const cleaned = cleanBrandAlias(alias);
    if (cleaned) {
      entities.add(cleaned);
    }
  }

  if (row.competitorThreat.kind === 'threat') {
    for (const winner of row.competitorThreat.winners.slice(0, 2)) {
      const name = winner.name.trim();
      if (name) {
        entities.add(name);
      }
    }
  }

  return Array.from(entities);
}

export function resolveTrackedBrandContext(row: VisibilityRow): TrackedBrandContext {
  return {
    brandLabel: resolveTrackedBrandLabel(row),
    brandWebsite: resolveTrackedBrandWebsite(row),
    targetEntities: deriveTargetEntitiesFromRow(row),
  };
}

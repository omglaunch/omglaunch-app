import { resolvePrimaryAction } from '@/lib/ai-visibility/deep-links';
import {
  cleanBrandAlias,
  deriveTargetEntitiesFromRow,
  resolveTrackedBrandLabel,
  resolveTrackedBrandWebsite,
} from '@/lib/ai-visibility/brand-context';
import { matchLocation } from '@/lib/ai-visibility/onboarding/match-location';
import type { VisibilityGapHydration, VisibilityRow } from '@/lib/ai-visibility/types';

export function isGapFillEligible(row: VisibilityRow): boolean {
  const action = resolvePrimaryAction(row);
  if (action.muted && action.route === 'monitor') {
    return false;
  }
  return true;
}

export { cleanBrandAlias } from '@/lib/ai-visibility/brand-context';

export function deriveTargetEntities(row: VisibilityRow): string[] {
  return deriveTargetEntitiesFromRow(row);
}

export function buildArticleTitleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return 'Untitled Article';
  }
  if (trimmed.length > 120) {
    return `${trimmed.slice(0, 117)}…`;
  }
  return trimmed;
}

export function buildSeoTitleFromPrompt(prompt: string): string {
  const title = buildArticleTitleFromPrompt(prompt);
  if (!title) return 'Untitled Article';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** @deprecated Use buildArticleTitleFromPrompt — kept for tests/callers */
export function buildGapTitleFromPrompt(prompt: string): string {
  return buildArticleTitleFromPrompt(prompt);
}

export function resolveGeoFromRow(row: VisibilityRow): { locationId: string; label: string } {
  if (row.geoLocationId?.trim()) {
    return {
      locationId: row.geoLocationId.trim(),
      label: row.geoTarget.trim() || row.geoLocationId.trim(),
    };
  }

  const matched = matchLocation(row.geoTarget);
  if (matched) {
    return { locationId: matched.locationId, label: matched.label };
  }

  return {
    locationId: 'global',
    label: row.geoTarget.trim() || 'Global / National (US fallback)',
  };
}

export function buildVisibilityGapHydration(row: VisibilityRow): VisibilityGapHydration {
  const title = buildArticleTitleFromPrompt(row.prompt);
  const seoTitle = buildSeoTitleFromPrompt(row.prompt);
  const geo = resolveGeoFromRow(row);
  const targetEntities = deriveTargetEntitiesFromRow(row);

  return {
    promptId: row.promptId,
    prompt: row.prompt,
    promptCluster: row.promptCluster,
    geo,
    keywordTargets: [row.prompt.trim()],
    targetEntities,
    title,
    seoTitle,
    trackedBrandName: resolveTrackedBrandLabel(row),
    brandWebsite: resolveTrackedBrandWebsite(row),
    sourceRoute: 'ai-visibility',
  };
}

export function resolvePromptIdFromSearchParams(
  params: URLSearchParams | { get: (key: string) => string | null }
): string | null {
  const promptId = params.get('prompt_id')?.trim() ?? params.get('gapId')?.trim() ?? '';
  return promptId || null;
}

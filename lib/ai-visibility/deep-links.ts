import type {
  TrackedEngine,
  VisibilityActionPayload,
  VisibilityActionRoute,
  VisibilityRow,
} from '@/lib/ai-visibility/types';
import {
  competitorMcRefIds,
  failedEngines,
  hasNegativeContext,
  isFullyCitedNumberOne,
  isOmittedEverywhere,
  isOutranked,
  isPartiallyOmitted,
  topOptimizeEngine,
  engineLabel,
} from '@/lib/ai-visibility/citation-eval';
import { storeVisibilityPrefill } from '@/lib/ai-visibility/prefill';

export { storeVisibilityPrefill };

export type PrimaryAction = {
  label: string;
  route: VisibilityActionRoute;
  muted?: boolean;
  engine?: TrackedEngine | 'top';
  dropdown: { label: string; route: VisibilityActionRoute; engine?: TrackedEngine }[];
};

export function resolvePrimaryAction(row: VisibilityRow): PrimaryAction {
  if (hasNegativeContext(row)) {
    return {
      label: 'Draft PR Rebuttal',
      route: 'pr-entity',
      dropdown: [
        { label: 'Open PR / Entity Module', route: 'pr-entity' },
        { label: 'Run AEO Gap Analysis', route: 'article-studio' },
      ],
    };
  }

  if (isOmittedEverywhere(row)) {
    return {
      label: 'Run AEO Gap Analysis',
      route: 'article-studio',
      dropdown: [
        { label: 'Analyze Competitors', route: 'article-studio' },
        { label: 'Inject Brand Entity', route: 'article-studio' },
      ],
    };
  }

  if (isPartiallyOmitted(row) || isOutranked(row)) {
    const target = topOptimizeEngine(row);
    const failed = failedEngines(row);
    return {
      label:
        target === 'top'
          ? 'Optimize Top Engine'
          : `Optimize ${engineLabel(target)}`,
      route: 'optimize-engine',
      engine: target,
      dropdown: failed.map((engine) => ({
        label: `Optimize ${engineLabel(engine)}`,
        route: 'optimize-engine' as const,
        engine,
      })),
    };
  }

  if (isFullyCitedNumberOne(row) || row.competitorThreat.kind === 'dominating') {
    return {
      label: 'Monitor Persistence',
      route: 'monitor',
      muted: true,
      dropdown: [],
    };
  }

  return {
    label: 'Run AEO Gap Analysis',
    route: 'article-studio',
    dropdown: [
      { label: 'Analyze Competitors', route: 'article-studio' },
      { label: 'Inject Brand Entity', route: 'article-studio' },
    ],
  };
}

export function rowToActionPayload(
  row: VisibilityRow,
  engine?: TrackedEngine
): VisibilityActionPayload {
  return {
    sourceRoute: 'ai-visibility',
    projectId: row.projectId ?? undefined,
    prompt: row.prompt,
    promptCluster: row.promptCluster,
    geoTarget: row.geoTarget,
    userTargetUrl: row.userTargetUrl,
    failedEngines: failedEngines(row),
    targetCompetitorDbRefIds: competitorMcRefIds(row.competitorThreat),
    promptId: row.promptId,
    geoLocationId: row.geoLocationId ?? undefined,
    engine,
  };
}

export function navigateToArticleStudioGap(
  row: VisibilityRow,
  navigate: (href: string) => void
): void {
  const payload = rowToActionPayload(row);
  storeVisibilityPrefill(payload);
  navigate(buildActionHref('article-studio', payload));
}

export function buildActionHref(
  route: VisibilityActionRoute,
  payload: VisibilityActionPayload
): string {
  const params = new URLSearchParams({
    sourceRoute: payload.sourceRoute,
    prompt_id: payload.promptId,
    prompt: payload.prompt,
    promptCluster: payload.promptCluster,
    geoTarget: payload.geoTarget,
    userTargetUrl: payload.userTargetUrl,
    failedEngines: payload.failedEngines.join(','),
    targetCompetitorDbRefIds: payload.targetCompetitorDbRefIds.join(','),
  });
  if (payload.projectId) params.set('projectId', payload.projectId);
  if (payload.engine) params.set('engine', payload.engine);
  if (payload.geoLocationId) params.set('geoLocationId', payload.geoLocationId);

  switch (route) {
    case 'pr-entity':
      return `/dashboard/competitor-intel?${params.toString()}`;
    case 'article-studio':
      return `/article-studio?${params.toString()}`;
    case 'optimize-engine':
      return `/page-optimizer?${params.toString()}`;
    case 'monitor':
      return `/ai-visibility?${params.toString()}`;
  }
}

export function buildArticleStudioAutoGenerateHref(
  payload: VisibilityActionPayload
): string {
  const params = new URLSearchParams({
    sourceRoute: payload.sourceRoute,
    prompt_id: payload.promptId,
    prompt: payload.prompt,
    promptCluster: payload.promptCluster,
    geoTarget: payload.geoTarget,
    userTargetUrl: payload.userTargetUrl,
    failedEngines: payload.failedEngines.join(','),
    targetCompetitorDbRefIds: payload.targetCompetitorDbRefIds.join(','),
    autoGenerate: '1',
  });
  if (payload.projectId) params.set('projectId', payload.projectId);
  if (payload.geoLocationId) params.set('geoLocationId', payload.geoLocationId);

  return `/article-studio?${params.toString()}`;
}

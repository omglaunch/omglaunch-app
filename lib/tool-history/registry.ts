import type { getPrisma } from '@/lib/prisma';
import type { ToolSlug } from '@/lib/tool-history/types';

type HistoryDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findFirst: (args: unknown) => Promise<unknown | null>;
  findUnique: (args: unknown) => Promise<unknown | null>;
  create: (args: unknown) => Promise<unknown>;
  createMany: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<unknown>;
  count: (args: unknown) => Promise<number>;
};

const SLUG_TO_DELEGATE: Record<ToolSlug, keyof ReturnType<typeof getPrisma>> = {
  'seo-analysis': 'seoAnalysisHistory',
  'semantic-analysis': 'semanticAnalysisHistory',
  'analysis-ai': 'analysisAIHistory',
  'page-optimizer': 'competitorCompareHistory',
  'page-audit': 'pageAuditHistory',
  'hub-spoke': 'hubSpokeHistory',
  'article-studio': 'articleStudioHistory',
  'query-comparison': 'queryComparisonHistory',
  'keyword-audit': 'keywordAuditHistory',
  'research-volumes': 'researchVolumesHistory',
  'suggested-keywords': 'suggestedKeywordsHistory',
  'rank-tracker': 'rankTrackerSnapshotHistory',
  'ai-content-writer': 'aIContentWriterHistory',
  'cms-publishing': 'cMSPublishingHistory',
};

/** Legacy API slugs kept for backward compatibility with saved bookmarks and clients. */
export const LEGACY_TOOL_SLUG_ALIASES: Record<string, ToolSlug> = {
  'competitor-compare': 'page-optimizer',
};

export function normalizeToolSlug(value: string): ToolSlug | null {
  if (value in SLUG_TO_DELEGATE) {
    return value as ToolSlug;
  }

  return LEGACY_TOOL_SLUG_ALIASES[value] ?? null;
}

export function isToolSlug(value: string): value is ToolSlug {
  return normalizeToolSlug(value) !== null;
}

export function getHistoryDelegate(
  prisma: ReturnType<typeof getPrisma>,
  tool: ToolSlug
): HistoryDelegate {
  const delegateKey = SLUG_TO_DELEGATE[tool];
  return prisma[delegateKey] as unknown as HistoryDelegate;
}

import type { Prisma } from '@prisma/client';

export const TOOL_SLUGS = [
  'seo-analysis',
  'semantic-analysis',
  'analysis-ai',
  'page-optimizer',
  'page-audit',
  'hub-spoke',
  'article-studio',
  'query-comparison',
  'keyword-audit',
  'research-volumes',
  'suggested-keywords',
  'rank-tracker',
  'ai-content-writer',
  'cms-publishing',
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

export type ToolHistoryEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  identifier: string;
  resultData: Prisma.JsonValue;
};

export type ToolHistorySummary = Pick<
  ToolHistoryEntry,
  'id' | 'createdAt' | 'updatedAt' | 'identifier'
> & {
  country?: string | null;
  city?: string | null;
  language?: string | null;
  device?: string | null;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
};

export type SaveToolHistoryInput = {
  identifier: string;
  resultData: unknown;
  workspaceId?: string;
  /** When set, updates the existing record instead of creating a duplicate. */
  id?: string;
};

export type UpdateToolHistoryInput = {
  identifier?: string;
  resultData: unknown;
  workspaceId?: string;
};

export type MigrateToolHistoryInput = {
  entries: Array<{
    identifier: string;
    resultData: unknown;
    createdAt?: string;
  }>;
  workspaceId?: string;
};

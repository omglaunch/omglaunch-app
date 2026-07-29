import type { ArticleRecord } from '@/lib/content-pipeline-data';

export type ArticleStudioDraftSource = 'brief' | 'blank' | 'quick-ai';

export type ArticleStudioHistoryPayload = {
  legacyBriefId?: number | null;
  targetKeyword: string;
  targetUrl?: string;
  briefContent?: string;
  draftTitle: string;
  draftContent: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  activeArticle: ArticleRecord | null;
  source: ArticleStudioDraftSource;
  wordCount?: number;
  additionalContext?: string;
  state: 'draft' | 'generated';
  savedAt: string;
};

export type ArticleStudioMetadataFields = {
  seoTitle?: string | null;
  metaDescription?: string | null;
};

function extractTitleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

export function buildStandaloneHistoryPayload(options: {
  title: string;
  content: string;
  source: Extract<ArticleStudioDraftSource, 'blank' | 'quick-ai'>;
  seoTitle?: string | null;
  metaDescription?: string | null;
  wordCount?: number;
  additionalContext?: string;
}): ArticleStudioHistoryPayload {
  const draftTitle = extractTitleFromMarkdown(options.content, options.title);

  return {
    legacyBriefId: null,
    targetKeyword: options.title,
    targetUrl: '',
    draftTitle,
    draftContent: options.content,
    seoTitle: options.seoTitle ?? null,
    metaDescription: options.metaDescription ?? null,
    activeArticle: null,
    source: options.source,
    wordCount: options.wordCount,
    additionalContext: options.additionalContext,
    state: options.source === 'quick-ai' ? 'generated' : 'draft',
    savedAt: new Date().toISOString(),
  };
}

export function buildBriefLinkedHistoryPayload(
  brief: {
    id: number;
    targetKeyword: string;
    targetUrl: string;
    content: string;
  },
  activeArticle: ArticleRecord,
  draftContent: string,
  metadata?: ArticleStudioMetadataFields
): ArticleStudioHistoryPayload {
  const draftTitle = extractTitleFromMarkdown(
    draftContent,
    activeArticle.title || brief.targetKeyword
  );

  return {
    legacyBriefId: brief.id,
    targetKeyword: brief.targetKeyword,
    targetUrl: brief.targetUrl,
    briefContent: brief.content,
    draftTitle,
    draftContent,
    seoTitle: metadata?.seoTitle ?? null,
    metaDescription: metadata?.metaDescription ?? null,
    activeArticle: {
      ...activeArticle,
      title: draftTitle,
      content: draftContent,
    },
    source: 'brief',
    state: 'draft',
    savedAt: new Date().toISOString(),
  };
}

export function parseArticleStudioHistoryPayload(
  value: unknown
): ArticleStudioHistoryPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const targetKeyword =
    typeof record.targetKeyword === 'string' ? record.targetKeyword : null;

  if (!targetKeyword) {
    return null;
  }

  const articles = Array.isArray(record.articles) ? record.articles : [];
  const firstArticle =
    articles[0] && typeof articles[0] === 'object'
      ? (articles[0] as Record<string, unknown>)
      : null;

  const draftContent =
    typeof record.draftContent === 'string'
      ? record.draftContent
      : typeof record.content === 'string'
        ? record.content
        : typeof firstArticle?.content === 'string'
          ? firstArticle.content
          : '';

  const draftTitle =
    typeof record.draftTitle === 'string'
      ? record.draftTitle
      : typeof firstArticle?.title === 'string'
        ? firstArticle.title
        : targetKeyword;

  const legacyBriefId =
    typeof record.legacyBriefId === 'number'
      ? record.legacyBriefId
      : typeof firstArticle?.briefId === 'number'
        ? firstArticle.briefId
        : null;

  const activeArticle =
    firstArticle &&
    typeof firstArticle.id === 'number' &&
    typeof firstArticle.briefId === 'number'
      ? {
          id: firstArticle.id,
          briefId: firstArticle.briefId,
          title: typeof firstArticle.title === 'string' ? firstArticle.title : draftTitle,
          content: typeof firstArticle.content === 'string' ? firstArticle.content : draftContent,
          createdAt:
            typeof firstArticle.createdAt === 'string'
              ? firstArticle.createdAt
              : new Date().toISOString(),
          updatedAt:
            typeof firstArticle.updatedAt === 'string'
              ? firstArticle.updatedAt
              : new Date().toISOString(),
        }
      : null;

  const source =
    record.source === 'blank' || record.source === 'quick-ai' || record.source === 'brief'
      ? record.source
      : legacyBriefId
        ? 'brief'
        : 'blank';

  return {
    legacyBriefId,
    targetKeyword,
    targetUrl: typeof record.targetUrl === 'string' ? record.targetUrl : '',
    briefContent:
      typeof record.briefContent === 'string'
        ? record.briefContent
        : typeof record.content === 'string'
          ? record.content
          : undefined,
    draftTitle,
    draftContent,
    seoTitle: typeof record.seoTitle === 'string' ? record.seoTitle : null,
    metaDescription:
      typeof record.metaDescription === 'string' ? record.metaDescription : null,
    activeArticle,
    source,
    wordCount: typeof record.wordCount === 'number' ? record.wordCount : undefined,
    additionalContext:
      typeof record.additionalContext === 'string' ? record.additionalContext : undefined,
    state: record.state === 'generated' ? 'generated' : 'draft',
    savedAt:
      typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
  };
}

export function isArticleStudioHistoryPayload(value: unknown): value is ArticleStudioHistoryPayload {
  return parseArticleStudioHistoryPayload(value) !== null;
}

export function isStandaloneHistoryPayload(value: unknown): boolean {
  if (!isArticleStudioHistoryPayload(value)) {
    return false;
  }

  return value.source === 'blank' || value.source === 'quick-ai';
}

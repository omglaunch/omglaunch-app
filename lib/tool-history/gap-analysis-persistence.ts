import type { GapArticleMetadata } from '@/lib/article-studio/gap-analysis-types';
import { GapArticleMetadataSchema } from '@/lib/article-studio/gap-analysis-types';

export type GapAnalysisHistoryPayload = {
  source: 'gap-analysis';
  linkedPromptId: string | null;
  targetKeyword: string;
  draftTitle: string;
  draftContent: string;
  gapMetadata: GapArticleMetadata;
  seoTitle: string;
  metaDescription: string;
  savedAt: string;
};

export function buildGapAnalysisHistoryPayload(input: {
  metadata: GapArticleMetadata;
  editorContent: string;
  linkedPromptId: string | null;
}): GapAnalysisHistoryPayload {
  const primaryKeyword = input.metadata.keywordTargets[0]?.trim() || input.metadata.title.trim();

  return {
    source: 'gap-analysis',
    linkedPromptId: input.linkedPromptId,
    targetKeyword: primaryKeyword || input.metadata.title.trim(),
    draftTitle: input.metadata.title.trim(),
    draftContent: input.editorContent,
    gapMetadata: input.metadata,
    seoTitle: input.metadata.seoTitle,
    metaDescription: input.metadata.metaDescription,
    savedAt: new Date().toISOString(),
  };
}

export function parseGapAnalysisHistoryPayload(value: unknown): GapAnalysisHistoryPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.source !== 'gap-analysis') {
    return null;
  }

  const gapMetadataRaw = record.gapMetadata;
  const parsedMetadata = GapArticleMetadataSchema.safeParse(gapMetadataRaw);
  if (!parsedMetadata.success) {
    return null;
  }

  const draftTitle =
    typeof record.draftTitle === 'string' && record.draftTitle.trim()
      ? record.draftTitle.trim()
      : parsedMetadata.data.title;

  const draftContent = typeof record.draftContent === 'string' ? record.draftContent : '';

  return {
    source: 'gap-analysis',
    linkedPromptId:
      typeof record.linkedPromptId === 'string' ? record.linkedPromptId : null,
    targetKeyword:
      typeof record.targetKeyword === 'string' && record.targetKeyword.trim()
        ? record.targetKeyword.trim()
        : draftTitle,
    draftTitle,
    draftContent,
    gapMetadata: parsedMetadata.data,
    seoTitle: parsedMetadata.data.seoTitle,
    metaDescription: parsedMetadata.data.metaDescription,
    savedAt:
      typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
  };
}

export function isGapAnalysisHistoryPayload(value: unknown): value is GapAnalysisHistoryPayload {
  return parseGapAnalysisHistoryPayload(value) !== null;
}

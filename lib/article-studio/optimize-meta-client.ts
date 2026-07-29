import { isMetaDescriptionAcceptable } from '@/lib/article-metadata';

export type OptimizeMetaDescriptionInput = {
  targetKeyword: string;
  seoTitle: string;
  articleContent: string;
  briefId?: number;
  existingMeta?: string;
};

export async function fetchOptimizedMetaDescription(
  input: OptimizeMetaDescriptionInput
): Promise<string | null> {
  const targetKeyword = input.targetKeyword.trim();
  const seoTitle = input.seoTitle.trim();
  const articleContent = input.articleContent.trim();
  const existingMeta = input.existingMeta?.trim() ?? '';

  if (!targetKeyword || !seoTitle || !articleContent) {
    return null;
  }

  if (existingMeta && isMetaDescriptionAcceptable(existingMeta, targetKeyword)) {
    return existingMeta;
  }

  const response = await fetch('/api/article-studio/optimize-meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetKeyword,
      seoTitle,
      articleContent,
      briefId: input.briefId,
      existingMeta: existingMeta || undefined,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : 'Meta description optimization failed';
    throw new Error(message);
  }

  const metaDescription =
    typeof payload === 'object' && payload !== null && 'metaDescription' in payload
      ? String(payload.metaDescription).trim()
      : '';

  return metaDescription || null;
}

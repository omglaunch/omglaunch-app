import type { ArticleStudioData } from '@/lib/content-pipeline-data';

export async function fetchArticleStudioData(workspaceId: string): Promise<ArticleStudioData> {
  if (!workspaceId.trim()) {
    return { briefs: [], articles: [] };
  }

  const params = new URLSearchParams({ workspaceId: workspaceId.trim() });
  const response = await fetch(`/api/article-studio/data?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load article studio data');
  }

  return response.json() as Promise<ArticleStudioData>;
}

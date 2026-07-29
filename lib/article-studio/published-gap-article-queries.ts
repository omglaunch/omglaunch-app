import { prisma } from '@/lib/prisma';

export async function getPublishedGapArticle(projectId: string, slug: string) {
  const normalizedProjectId = projectId.trim();
  const normalizedSlug = slug.trim();
  if (!normalizedProjectId || !normalizedSlug) {
    return null;
  }

  return prisma.publishedGapArticle.findUnique({
    where: {
      projectId_slug: {
        projectId: normalizedProjectId,
        slug: normalizedSlug,
      },
    },
  });
}

/** Legacy slug-only lookup — may return multiple rows across projects. */
export async function findPublishedGapArticlesBySlug(slug: string) {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return [];
  }

  return prisma.publishedGapArticle.findMany({
    where: { slug: normalizedSlug },
    orderBy: { publishedAt: 'desc' },
  });
}

/** @deprecated Use getPublishedGapArticle(projectId, slug). */
export async function getPublishedGapArticleBySlug(slug: string) {
  const matches = await findPublishedGapArticlesBySlug(slug);
  return matches.length === 1 ? matches[0]! : null;
}

export function buildPublishedGapArticlePath(projectId: string, slug: string): string {
  return `/articles/${encodeURIComponent(projectId)}/${encodeURIComponent(slug)}`;
}

export async function ensureUniqueGapArticleSlug(
  projectId: string,
  preferredSlug: string
): Promise<string> {
  let candidate = preferredSlug.trim();
  if (!candidate) {
    candidate = 'article';
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const existing = await prisma.publishedGapArticle.findUnique({
      where: {
        projectId_slug: {
          projectId,
          slug: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${preferredSlug}-${attempt + 2}`;
  }

  return `${preferredSlug}-${Date.now().toString(36)}`;
}

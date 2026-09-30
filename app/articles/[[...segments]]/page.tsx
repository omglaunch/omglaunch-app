import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArticleMarkdown } from '@/components/articles/ArticleMarkdown';
import {
  buildPublishedGapArticlePath,
  findPublishedGapArticlesBySlug,
  getPublishedGapArticle,
} from '@/lib/article-studio/published-gap-article-queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = {
  params: { segments?: string[] };
};

function extractJsonLdScripts(jsonLd: unknown): Record<string, unknown>[] {
  if (typeof jsonLd !== 'object' || jsonLd === null) return [];

  const record = jsonLd as Record<string, unknown>;
  if (Array.isArray(record.combined)) {
    return record.combined.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
    );
  }

  const scripts: Record<string, unknown>[] = [];
  if (record.article && typeof record.article === 'object') {
    scripts.push(record.article as Record<string, unknown>);
  }
  if (record.faq && typeof record.faq === 'object') {
    scripts.push(record.faq as Record<string, unknown>);
  }
  return scripts;
}

function resolveArticleParams(segments: string[] | undefined): {
  mode: 'canonical';
  projectId: string;
  slug: string;
} | {
  mode: 'legacy';
  slug: string;
} | null {
  if (!segments || segments.length === 0) {
    return null;
  }

  if (segments.length === 2) {
    const [projectId, slug] = segments;
    if (!projectId?.trim() || !slug?.trim()) {
      return null;
    }
    return { mode: 'canonical', projectId: projectId.trim(), slug: slug.trim() };
  }

  if (segments.length === 1) {
    const slug = segments[0]?.trim();
    if (!slug) {
      return null;
    }
    return { mode: 'legacy', slug };
  }

  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = resolveArticleParams(params.segments);
  if (!resolved) {
    return { title: 'Article Not Found' };
  }

  if (resolved.mode === 'legacy') {
    return { title: 'Article' };
  }

  const article = await getPublishedGapArticle(resolved.projectId, resolved.slug);
  if (!article) {
    return { title: 'Article Not Found' };
  }

  const metadata =
    typeof article.metadata === 'object' && article.metadata !== null
      ? (article.metadata as Record<string, unknown>)
      : {};

  const seoTitle =
    typeof metadata.seoTitle === 'string' && metadata.seoTitle.trim()
      ? metadata.seoTitle.trim()
      : article.title;

  const metaDescription =
    typeof metadata.metaDescription === 'string' ? metadata.metaDescription.trim() : '';

  return {
    title: seoTitle,
    description: metaDescription || undefined,
  };
}

export default async function PublishedArticlePage({ params }: PageProps) {
  const resolved = resolveArticleParams(params.segments);
  if (!resolved) {
    notFound();
  }

  if (resolved.mode === 'legacy') {
    const matches = await findPublishedGapArticlesBySlug(resolved.slug);

    if (matches.length === 1) {
      redirect(buildPublishedGapArticlePath(matches[0]!.projectId, matches[0]!.slug));
    }

    notFound();
  }

  const article = await getPublishedGapArticle(resolved.projectId, resolved.slug);

  if (!article) {
    notFound();
  }

  const metadata =
    typeof article.metadata === 'object' && article.metadata !== null
      ? (article.metadata as Record<string, unknown>)
      : {};

  const seoTitle =
    typeof metadata.seoTitle === 'string' && metadata.seoTitle.trim()
      ? metadata.seoTitle.trim()
      : article.title;

  const jsonLdScripts = extractJsonLdScripts(article.jsonLd);

  return (
    <>
      {jsonLdScripts.map((schema, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <article className="min-h-screen bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <header className="mb-8 border-b border-slate-200 pb-6 dark:border-zinc-800">
            {article.cluster ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                {article.cluster}
                {article.geoLabel ? ` · ${article.geoLabel}` : ''}
              </p>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight">{seoTitle}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              Published {article.publishedAt.toLocaleDateString(undefined, { dateStyle: 'long' })}
            </p>
          </header>

          <div className="article-markdown-preview prose prose-slate max-w-none dark:prose-invert">
            <ArticleMarkdown content={article.content} />
          </div>
        </div>
      </article>
    </>
  );
}

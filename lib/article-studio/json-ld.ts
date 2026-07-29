import type { FaqSchemaEntry, GapArticleMetadata } from './gap-analysis-types';

export type ArticleJsonLdBundle = {
  article: Record<string, unknown>;
  faq: Record<string, unknown> | null;
  combined: Record<string, unknown>[];
};

function normalizeWebsiteUrl(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return 'https://example.com';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

export function slugifyTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `article-${suffix}`;
}

export function buildArticleJsonLd(input: {
  metadata: GapArticleMetadata;
  slug: string;
  website: string;
  brandName: string;
  publishedAt: string;
  modifiedAt: string;
}): Record<string, unknown> {
  const baseUrl = normalizeWebsiteUrl(input.website);
  const pageUrl = `${baseUrl}/articles/${input.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    headline: input.metadata.seoTitle || input.metadata.title,
    name: input.metadata.title,
    description: input.metadata.metaDescription,
    url: pageUrl,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt,
    author: {
      '@type': 'Organization',
      name: input.brandName,
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: input.brandName,
      url: baseUrl,
    },
    about: input.metadata.targetEntities.map(entity => ({
      '@type': 'Thing',
      name: entity,
    })),
    keywords: input.metadata.keywordTargets.join(', '),
    spatialCoverage: input.metadata.geo.label,
    isPartOf: input.metadata.cluster
      ? {
          '@type': 'CreativeWork',
          name: input.metadata.cluster,
        }
      : undefined,
    citation: input.metadata.authoritativeUrls.map(url => ({
      '@type': 'CreativeWork',
      url,
    })),
  };
}

export function buildFaqJsonLd(faqs: FaqSchemaEntry[]): Record<string, unknown> | null {
  if (faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildArticleJsonLdBundle(input: {
  metadata: GapArticleMetadata;
  slug: string;
  website: string;
  brandName: string;
  publishedAt: string;
  modifiedAt: string;
}): ArticleJsonLdBundle {
  const article = buildArticleJsonLd(input);
  const faq = buildFaqJsonLd(input.metadata.faqSchemas);
  const combined = faq ? [article, faq] : [article];

  return { article, faq, combined };
}

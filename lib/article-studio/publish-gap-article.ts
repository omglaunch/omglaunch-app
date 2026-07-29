import { prisma } from '@/lib/prisma';
import { buildArticleJsonLdBundle, slugifyTitle } from '@/lib/article-studio/json-ld';
import {
  GapArticleMetadataSchema,
  PublishGapArticleRequestSchema,
} from '@/lib/article-studio/gap-analysis-types';
import { regenerateDomainProfileDraft } from '@/lib/domain-profile/regenerate';
import { SYSTEM_AUDIT_ACTOR } from '@/lib/audit/brand-manifest-audit';
import {
  buildPublishedGapArticlePath,
  ensureUniqueGapArticleSlug,
} from '@/lib/article-studio/published-gap-article-queries';
import { requireAccessibleProjectWriteId } from '@/lib/projects/team-access';
import type { Prisma } from '@prisma/client';

export class PublishGapArticleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishGapArticleError';
  }
}

async function resolvePublishContext(projectId: string, workspaceId: string) {
  const [project, brandProfile, owner] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true, domain: true },
    }),
    prisma.aeoBrandProfile.findUnique({
      where: { projectId },
      select: { brandLabel: true, primaryUrl: true },
    }),
    prisma.user.findUnique({ where: { id: workspaceId } }),
  ]);

  if (!project) {
    throw new PublishGapArticleError('Project not found for publish.');
  }

  const brandName = brandProfile?.brandLabel.trim() || project.name.trim() || 'Client Brand';
  const rawWebsite =
    brandProfile?.primaryUrl.trim() ||
    (project.domain?.trim()
      ? project.domain.trim().startsWith('http')
        ? project.domain.trim()
        : `https://${project.domain.trim()}`
      : 'https://example.com');

  return { brandName, website: rawWebsite, ownerEmail: owner?.email ?? null };
}

export async function publishGapArticle(input: {
  workspaceId: string;
  projectId: string;
  content: string;
  metadata: unknown;
  articleId?: number;
  briefId?: number;
}) {
  const parsed = PublishGapArticleRequestSchema.parse(input);
  const metadata = GapArticleMetadataSchema.parse(parsed.metadata);

  if (!parsed.content.trim()) {
    throw new PublishGapArticleError('Article content cannot be empty.');
  }

  await requireAccessibleProjectWriteId(parsed.projectId);
  const context = await resolvePublishContext(parsed.projectId, parsed.workspaceId);
  const baseSlug = slugifyTitle(metadata.title);
  const slug = await ensureUniqueGapArticleSlug(parsed.projectId, baseSlug);
  const now = new Date().toISOString();

  const jsonLdBundle = buildArticleJsonLdBundle({
    metadata,
    slug,
    website: context.website,
    brandName: context.brandName,
    publishedAt: now,
    modifiedAt: now,
  });

  const metadataJson = metadata as unknown as Prisma.InputJsonValue;
  const jsonLdJson = {
    article: jsonLdBundle.article,
    faq: jsonLdBundle.faq,
    combined: jsonLdBundle.combined,
  } as unknown as Prisma.InputJsonValue;

  const published = await prisma.$transaction(
    async tx => {
      let articleRecord = null;

      if (parsed.briefId) {
        const brief = await tx.contentBrief.findUnique({
          where: { id: parsed.briefId },
        });
        if (brief) {
          articleRecord = await tx.article.upsert({
            where: { briefId: parsed.briefId },
            create: {
              briefId: parsed.briefId,
              title: metadata.title,
              content: parsed.content,
            },
            update: {
              title: metadata.title,
              content: parsed.content,
            },
          });
        }
      } else if (parsed.articleId) {
        articleRecord = await tx.article.update({
          where: { id: parsed.articleId },
          data: {
            title: metadata.title,
            content: parsed.content,
          },
        });
      }

      const gapArticle = await tx.publishedGapArticle.create({
        data: {
          workspaceId: parsed.workspaceId,
          projectId: parsed.projectId,
          slug,
          title: metadata.title,
          content: parsed.content,
          metadata: metadataJson,
          jsonLd: jsonLdJson,
          cluster: metadata.cluster || null,
          geoLabel: metadata.geo.label || null,
        },
      });

      return { gapArticle, articleRecord };
    },
    { isolationLevel: 'Serializable' }
  );

  let manifestVersion = 0;
  try {
    const manifestResult = await regenerateDomainProfileDraft(parsed.projectId, {
      workspaceId: parsed.workspaceId,
      actor: SYSTEM_AUDIT_ACTOR,
      source: 'gap_article_publish',
    });
    manifestVersion = manifestResult.publishedVersion;
  } catch (error) {
    console.warn('[publish-gap-article] Domain profile regeneration failed:', error);
  }

  return {
    slug: published.gapArticle.slug,
    id: published.gapArticle.id,
    projectId: parsed.projectId,
    publishedAt: published.gapArticle.publishedAt.toISOString(),
    articleUrl: buildPublishedGapArticlePath(parsed.projectId, published.gapArticle.slug),
    manifestVersion,
    articleRecordId: published.articleRecord?.id ?? null,
  };
}

export {
  buildPublishedGapArticlePath,
  ensureUniqueGapArticleSlug,
  findPublishedGapArticlesBySlug,
  getPublishedGapArticle,
  getPublishedGapArticleBySlug,
} from '@/lib/article-studio/published-gap-article-queries';

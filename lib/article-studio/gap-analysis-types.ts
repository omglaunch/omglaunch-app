import { z } from 'zod';

export const FaqSchemaEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const AeoStructureBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['summary', 'entity-spotlight', 'faq', 'citation', 'geo-context']),
  heading: z.string().min(1),
  body: z.string(),
});

/** Strict metadata object — never parsed from HTML */
export const GapArticleMetadataSchema = z.object({
  title: z.string().min(1),
  targetEntities: z.array(z.string().min(1)),
  cluster: z.string(),
  geo: z.object({
    locationId: z.string(),
    label: z.string(),
  }),
  faqSchemas: z.array(FaqSchemaEntrySchema),
  authoritativeUrls: z.array(z.string().url()),
  keywordTargets: z.array(z.string().min(1)),
  aeoBlocks: z.array(AeoStructureBlockSchema),
  seoTitle: z.string(),
  metaDescription: z.string(),
});

export type GapArticleMetadata = z.infer<typeof GapArticleMetadataSchema>;
export type FaqSchemaEntry = z.infer<typeof FaqSchemaEntrySchema>;
export type AeoStructureBlock = z.infer<typeof AeoStructureBlockSchema>;

export const PublishGapArticleRequestSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  content: z.string().min(1),
  metadata: GapArticleMetadataSchema,
  articleId: z.number().int().positive().optional(),
  briefId: z.number().int().positive().optional(),
});

export type PublishGapArticleRequest = z.infer<typeof PublishGapArticleRequestSchema>;

/** Structured output from Auto-Extract AEO — does not include matrix baseline fields */
export const AeoExtractResultSchema = z
  .object({
    metaDescription: z.string().max(160),
    seoTitle: z.string().min(1).max(120),
    faqSchemas: z
      .array(
        z
          .object({
            question: z.string().min(1),
            answer: z.string().min(1),
          })
          .strict()
      )
      .min(2)
      .max(3),
    authoritativeUrls: z.array(z.string().url()),
  })
  .strict();

export type AeoExtractResult = z.infer<typeof AeoExtractResultSchema>;

export const ExtractAeoMetadataRequestSchema = z.object({
  content: z.string().min(80, 'Add more draft content before extracting metadata'),
  keywordTargets: z.array(z.string()).optional(),
  cluster: z.string().optional(),
});

export type ExtractAeoMetadataRequest = z.infer<typeof ExtractAeoMetadataRequestSchema>;

export const AEO_EXTRACT_CREDIT_COST = 1;

export function sanitizeAuthoritativeUrls(urls: string[]): string[] {
  const valid = new Set<string>();

  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        valid.add(parsed.toString());
      }
    } catch {
      // Skip values the model returned that are not valid URLs.
    }
  }

  return Array.from(valid);
}

/** OpenAI structured output schema — must not use z.string().url() (uri format is rejected). */
export const OpenAiAutoGenerateGapArticleSchema = z
  .object({
    title: z.string().min(1),
    seoTitle: z.string().min(1).max(120),
    metaDescription: z.string().max(160),
    cluster: z.string().min(1),
    geo: z
      .object({
        locationId: z.string().min(1),
        label: z.string().min(1),
      })
      .strict(),
    keywordTargets: z.array(z.string().min(1)).min(1).max(8),
    targetEntities: z.array(z.string().min(1)).min(1),
    authoritativeUrls: z.array(z.string()),
    faqSchemas: z
      .array(
        z
          .object({
            question: z.string().min(1),
            answer: z.string().min(1),
          })
          .strict()
      )
      .min(2)
      .max(5),
    aeoBlocks: z
      .object({
        executiveSummary: z.string().min(1),
        entitySpotlight: z.string().min(1),
      })
      .strict(),
    content: z.string().min(200),
  })
  .strict();

/** Structured output for full gap article auto-generation (validated domain type). */
export const AutoGenerateGapArticleSchema = z
  .object({
    title: z.string().min(1),
    seoTitle: z.string().min(1).max(120),
    metaDescription: z.string().max(160),
    cluster: z.string().min(1),
    geo: z
      .object({
        locationId: z.string().min(1),
        label: z.string().min(1),
      })
      .strict(),
    keywordTargets: z.array(z.string().min(1)).min(1).max(8),
    targetEntities: z.array(z.string().min(1)).min(1),
    authoritativeUrls: z.array(z.string().url()),
    faqSchemas: z
      .array(
        z
          .object({
            question: z.string().min(1),
            answer: z.string().min(1),
          })
          .strict()
      )
      .min(2)
      .max(5),
    aeoBlocks: z
      .object({
        executiveSummary: z.string().min(1),
        entitySpotlight: z.string().min(1),
      })
      .strict(),
    content: z.string().min(200),
  })
  .strict();

export type AutoGenerateGapArticle = z.infer<typeof AutoGenerateGapArticleSchema>;

export function parseAutoGenerateGapArticle(
  raw: z.infer<typeof OpenAiAutoGenerateGapArticleSchema>
): AutoGenerateGapArticle {
  return AutoGenerateGapArticleSchema.parse({
    ...raw,
    authoritativeUrls: sanitizeAuthoritativeUrls(raw.authoritativeUrls),
    metaDescription: raw.metaDescription.slice(0, 160),
  });
}

/** OpenAI structured output schema for metadata extract — avoids z.string().url(). */
export const OpenAiAeoExtractSchema = z
  .object({
    metaDescription: z.string().max(160),
    seoTitle: z.string().min(1).max(120),
    faqSchemas: z
      .array(
        z
          .object({
            question: z.string().min(1),
            answer: z.string().min(1),
          })
          .strict()
      )
      .min(2)
      .max(3),
    authoritativeUrls: z.array(z.string()),
  })
  .strict();

export function parseAeoExtractResult(
  raw: z.infer<typeof OpenAiAeoExtractSchema>,
  extraUrls: string[] = []
): AeoExtractResult {
  return AeoExtractResultSchema.parse({
    ...raw,
    authoritativeUrls: sanitizeAuthoritativeUrls([...extraUrls, ...raw.authoritativeUrls]),
    metaDescription: raw.metaDescription.slice(0, 160),
  });
}

export const AutoGenerateGapArticleRequestSchema = z.object({
  promptId: z.string().min(1),
  projectId: z.string().min(1),
  promptText: z.string().min(1).optional(),
  missingEntities: z.array(z.string()).optional(),
});

export type AutoGenerateGapArticleRequest = z.infer<
  typeof AutoGenerateGapArticleRequestSchema
>;

export const AUTO_GENERATE_GAP_CREDIT_COST = 3;

export function mapAutoGenerateToGapDraft(result: AutoGenerateGapArticle): {
  metadata: GapArticleMetadata;
  content: string;
} {
  return {
    content: result.content,
    metadata: {
      title: result.title,
      seoTitle: result.seoTitle,
      metaDescription: result.metaDescription,
      cluster: result.cluster,
      geo: result.geo,
      keywordTargets: result.keywordTargets,
      targetEntities: result.targetEntities,
      authoritativeUrls: result.authoritativeUrls,
      faqSchemas: result.faqSchemas,
      aeoBlocks: [
        {
          id: 'summary',
          type: 'summary',
          heading: 'Executive Summary',
          body: result.aeoBlocks.executiveSummary,
        },
        {
          id: 'entity-spotlight',
          type: 'entity-spotlight',
          heading: 'Entity Spotlight',
          body: result.aeoBlocks.entitySpotlight,
        },
      ],
    },
  };
}

export function createDefaultGapMetadata(input?: {
  title?: string;
  cluster?: string;
  geo?: { locationId: string; label: string };
  keywordTargets?: string[];
}): GapArticleMetadata {
  return {
    title: input?.title ?? 'Untitled Gap Article',
    targetEntities: [],
    cluster: input?.cluster ?? '',
    geo: input?.geo ?? { locationId: 'global', label: 'Global' },
    faqSchemas: [],
    authoritativeUrls: [],
    keywordTargets: input?.keywordTargets ?? [],
    aeoBlocks: [
      {
        id: 'summary',
        type: 'summary',
        heading: 'Executive Summary',
        body: '',
      },
      {
        id: 'entity-spotlight',
        type: 'entity-spotlight',
        heading: 'Entity Spotlight',
        body: '',
      },
    ],
    seoTitle: input?.title ?? '',
    metaDescription: '',
  };
}

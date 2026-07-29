import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { resolveTrackedBrandContext } from '@/lib/ai-visibility/brand-context';
import { failedEngines } from '@/lib/ai-visibility/citation-eval';
import {
  buildArticleTitleFromPrompt,
  buildSeoTitleFromPrompt,
  resolveGeoFromRow,
} from '@/lib/ai-visibility/gap-fill';
import { findVisibilityRowForProject } from '@/lib/ai-visibility/visibility-repository';
import type { VisibilityRow } from '@/lib/ai-visibility/types';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { deductCredits, INSUFFICIENT_CREDITS_ERROR } from '@/lib/credits';
import {
  AUTO_GENERATE_GAP_CREDIT_COST,
  mapAutoGenerateToGapDraft,
  OpenAiAutoGenerateGapArticleSchema,
  parseAutoGenerateGapArticle,
  type AutoGenerateGapArticle,
  type GapArticleMetadata,
} from '@/lib/article-studio/gap-analysis-types';

export class AutoGenerateGapArticleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoGenerateGapArticleError';
  }
}

function buildUserPrompt(input: {
  promptText: string;
  row?: VisibilityRow;
  missingEntities: string[];
}): string {
  const { promptText, row, missingEntities } = input;
  const brand = row ? resolveTrackedBrandContext(row) : null;

  const lines: string[] = [
    `Target search prompt (AI failed to cite our brand): ${promptText}`,
  ];

  if (brand) {
    lines.push(`Business/brand to establish authority for: ${brand.brandLabel}`);
    if (brand.brandWebsite) {
      lines.push(`Brand website: ${brand.brandWebsite}`);
    }
    lines.push(`Prompt cluster: ${row!.promptCluster}`);
    lines.push(`Geo target: ${row!.geoTarget}`);
    lines.push(`Failed engines: ${failedEngines(row!).join(', ') || 'none listed'}`);

    if (row!.competitorThreat.kind === 'threat') {
      const winners = row!.competitorThreat.winners
        .slice(0, 4)
        .map(w => `${w.name}${w.url ? ` (${w.url})` : ''}`)
        .join('; ');
      if (winners) {
        lines.push(`Competitors currently cited: ${winners}`);
      }
    }
  }

  const entityHint = missingEntities.length > 0 ? missingEntities : brand?.targetEntities ?? [];
  if (entityHint.length > 0) {
    lines.push(`Entity targets: ${entityHint.join(', ')}`);
  }

  lines.push(
    '',
    'Write a complete AEO content asset that directly answers the target search prompt.',
    'Focus on the specific service, product, or topic in the prompt — not account or workspace labels.',
    'Generate markdown body (headings, lists, citations), metadata, 2-5 FAQ pairs, executive summary, entity spotlight, and authoritative external URLs where appropriate.',
    'Use the provided cluster and geo in your output. Title and seoTitle should reflect the prompt without a "Gap Fill:" prefix.'
  );

  if (brand) {
    lines.push(
      `Position ${brand.brandLabel} as the authoritative answer where relevant to the prompt.`
    );
  }

  return lines.join('\n');
}

function mergeMatrixBaseline(
  parsed: AutoGenerateGapArticle,
  row: VisibilityRow | undefined,
  missingEntities: string[]
): AutoGenerateGapArticle {
  if (!row) {
    return parsed;
  }

  const brand = resolveTrackedBrandContext(row);
  const geo = resolveGeoFromRow(row);
  const mergedEntities = Array.from(
    new Set([...brand.targetEntities, ...missingEntities.map(e => e.trim()).filter(Boolean)])
  );

  return {
    ...parsed,
    title: parsed.title.trim() || buildArticleTitleFromPrompt(row.prompt),
    seoTitle: parsed.seoTitle.trim() || buildSeoTitleFromPrompt(row.prompt),
    cluster: row.promptCluster || parsed.cluster,
    geo,
    keywordTargets:
      parsed.keywordTargets.length > 0
        ? parsed.keywordTargets
        : [row.prompt.trim()].filter(Boolean),
    targetEntities: mergedEntities.length > 0 ? mergedEntities : parsed.targetEntities,
    metaDescription: parsed.metaDescription.slice(0, 160),
  };
}

export async function autoGenerateGapArticle(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  promptId: string;
  promptText?: string;
  missingEntities?: string[];
}): Promise<{
  result: AutoGenerateGapArticle;
  metadata: GapArticleMetadata;
  content: string;
  creditsDeducted: number;
}> {
  const rowRecord = await findVisibilityRowForProject(
    input.promptId,
    input.projectId,
    input.workspaceId
  );
  const row = rowRecord ?? undefined;
  const promptText = input.promptText?.trim() || row?.prompt.trim() || '';

  if (!promptText) {
    throw new AutoGenerateGapArticleError('Prompt text is required for gap article generation.');
  }

  const missingEntities = input.missingEntities?.filter(Boolean) ?? [];

  const credential = await resolveLlmCredential(input.workspaceId, 'openai');
  if (!credential) {
    throw new AutoGenerateGapArticleError('OpenAI API key is not configured for this workspace.');
  }

  const client = new OpenAI({ apiKey: credential.apiKey });

  let completion;
  try {
    completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert AEO (Artificial Engine Optimization) copywriter. Given a prompt where an AI failed to cite our brand, generate a complete, highly structured content asset and metadata package designed to establish domain authority and fill this visibility gap.',
        },
        {
          role: 'user',
        content: buildUserPrompt({
          promptText,
          row,
          missingEntities,
        }),
        },
      ],
      response_format: zodResponseFormat(
        OpenAiAutoGenerateGapArticleSchema,
        'gap_article_generation'
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'OpenAI gap article generation failed';
    throw new AutoGenerateGapArticleError(message);
  }

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new AutoGenerateGapArticleError(
      message.refusal || 'The model refused to generate content for this visibility gap.'
    );
  }

  if (!message?.parsed) {
    const finishReason = completion.choices[0]?.finish_reason;
    throw new AutoGenerateGapArticleError(
      finishReason === 'length'
        ? 'Generated draft was truncated. Retry or shorten the prompt scope.'
        : 'Gap article generation returned invalid structured output.'
    );
  }

  let parsed: AutoGenerateGapArticle;
  try {
    parsed = parseAutoGenerateGapArticle(message.parsed);
  } catch {
    throw new AutoGenerateGapArticleError(
      'Gap article generation returned metadata that failed validation.'
    );
  }

  const merged = mergeMatrixBaseline(parsed, row, missingEntities);

  const { metadata, content } = mapAutoGenerateToGapDraft(merged);

  let creditsDeducted = 0;
  if (credential.usesCredits) {
    try {
      await deductCredits(
        input.userId,
        AUTO_GENERATE_GAP_CREDIT_COST,
        'article-studio:auto-generate-gap'
      );
      creditsDeducted = AUTO_GENERATE_GAP_CREDIT_COST;
    } catch (error) {
      if (error instanceof Error && error.message === INSUFFICIENT_CREDITS_ERROR) {
        throw new AutoGenerateGapArticleError('Insufficient credits for gap article generation.');
      }
      throw error;
    }
  }

  return { result: merged, metadata, content, creditsDeducted };
}

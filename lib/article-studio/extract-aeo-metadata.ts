import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { deductCredits, INSUFFICIENT_CREDITS_ERROR } from '@/lib/credits';
import {
  AEO_EXTRACT_CREDIT_COST,
  OpenAiAeoExtractSchema,
  parseAeoExtractResult,
  type AeoExtractResult,
} from '@/lib/article-studio/gap-analysis-types';

export class AeoExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AeoExtractError';
  }
}

export function extractMarkdownUrls(content: string): string[] {
  const urls = new Set<string>();

  const linkPattern = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkPattern.exec(content)) !== null) {
    urls.add(linkMatch[2]!);
  }

  const barePattern = /https?:\/\/[^\s)\]"'<>]+/g;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = barePattern.exec(content)) !== null) {
    urls.add(bareMatch[0]!.replace(/[.,;:!?)]+$/, ''));
  }

  return Array.from(urls);
}

export async function extractAeoMetadataFromContent(input: {
  workspaceId: string;
  userId: string;
  content: string;
  keywordTargets?: string[];
  cluster?: string;
}): Promise<{ result: AeoExtractResult; creditsDeducted: number }> {
  const content = input.content.trim();
  if (content.length < 80) {
    throw new AeoExtractError('Add more draft content before extracting metadata.');
  }

  const credential = await resolveLlmCredential(input.workspaceId, 'openai');
  if (!credential) {
    throw new AeoExtractError('OpenAI API key is not configured for this workspace.');
  }

  const preParsedUrls = extractMarkdownUrls(content);
  const keywordHint = input.keywordTargets?.filter(Boolean).join(', ') ?? '';
  const clusterHint = input.cluster?.trim() ?? '';

  const client = new OpenAI({ apiKey: credential.apiKey });

  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You extract AEO metadata from draft article content. Return concise SEO metadata, 2-3 FAQ Q&A pairs grounded in the text, and authoritative external URLs cited or linked in the content. Merge any pre-parsed URLs provided.',
      },
      {
        role: 'user',
        content: [
          clusterHint ? `Cluster context: ${clusterHint}` : '',
          keywordHint ? `Primary keywords: ${keywordHint}` : '',
          preParsedUrls.length
            ? `Pre-parsed URLs (include in authoritativeUrls): ${preParsedUrls.join(', ')}`
            : '',
          '---',
          content,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    response_format: zodResponseFormat(OpenAiAeoExtractSchema, 'aeo_metadata_extract'),
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new AeoExtractError(
      message.refusal || 'The model refused to extract metadata for this content.'
    );
  }

  if (!message?.parsed) {
    throw new AeoExtractError('Metadata extraction returned invalid structured output.');
  }

  const result = parseAeoExtractResult(message.parsed, preParsedUrls);

  let creditsDeducted = 0;
  if (credential.usesCredits) {
    try {
      await deductCredits(
        input.userId,
        AEO_EXTRACT_CREDIT_COST,
        'article-studio:aeo-metadata-extract'
      );
      creditsDeducted = AEO_EXTRACT_CREDIT_COST;
    } catch (error) {
      if (error instanceof Error && error.message === INSUFFICIENT_CREDITS_ERROR) {
        throw new AeoExtractError('Insufficient credits for metadata extraction.');
      }
      throw error;
    }
  }

  return { result, creditsDeducted };
}

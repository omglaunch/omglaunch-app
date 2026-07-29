import { GoogleGenAI, Type } from '@google/genai';
import {
  extractArticleMetadata,
  isMetaDescriptionAcceptable,
  truncateMetaDescription,
} from '@/lib/article-metadata';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';

export type GenerateOptimizedMetaDescriptionInput = {
  targetKeyword: string;
  seoTitle: string;
  articleContent: string;
  briefContent?: string;
};

const META_DESCRIPTION_SYSTEM_PROMPT = `You are an elite SEO and GEO (Generative Engine Optimization) metadata strategist.

Your sole task is to write ONE meta description that performs in both traditional SERPs and AI answer engines (ChatGPT, Perplexity, Google AI Overviews).

REQUIREMENTS:
- Length: 145–160 characters (hard max 160).
- Place the primary keyword naturally within the first 120 characters.
- Lead with a direct, extractable value proposition — no filler ("In this article...", "Welcome to...").
- Use concrete entities and specifics from the article/brief (materials, methods, outcomes) — never vague pronouns.
- Match search intent (informational, commercial, or transactional) implied by the keyword.
- Include a subtle action or outcome hook (learn, compare, fix, choose, prevent, etc.).
- Write as a standalone citation chunk an LLM could quote without surrounding page context.
- No markdown, quotes, emojis, or pipe characters.
- Do not repeat the SEO title verbatim.

Return strict JSON only: { "metaDescription": "..." }`;

function summarizeArticleForMeta(content: string, maxChars = 2400): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (plain.length <= maxChars) {
    return plain;
  }

  return `${plain.slice(0, maxChars).trim()}…`;
}

function summarizeBriefForMeta(briefContent: string | undefined, maxChars = 1200): string {
  if (!briefContent?.trim()) {
    return '';
  }

  const trimmed = briefContent.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars).trim()}…`;
}

function buildUserPrompt(input: GenerateOptimizedMetaDescriptionInput): string {
  const sections = [
    `Target Keyword: ${input.targetKeyword.trim()}`,
    `SEO Title: ${input.seoTitle.trim()}`,
    '',
    'Article Summary (for context):',
    summarizeArticleForMeta(input.articleContent),
  ];

  const briefSummary = summarizeBriefForMeta(input.briefContent);
  if (briefSummary) {
    sections.push('', 'Content Brief (semantic gaps & strategy):', briefSummary);
  }

  sections.push('', 'Write the optimized meta description now.');
  return sections.join('\n');
}

export async function generateOptimizedMetaDescription(
  input: GenerateOptimizedMetaDescriptionInput,
  apiKey: string,
  workspaceId?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await withIntegrationTelemetry(
    {
      integrationType: 'GEMINI',
      targetUrl: 'gemini-2.5-flash',
      workspaceId,
      operation: 'meta_description_generation',
    },
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildUserPrompt(input),
        config: {
          systemInstruction: META_DESCRIPTION_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              metaDescription: { type: Type.STRING },
            },
            required: ['metaDescription'],
          },
        },
      })
  );

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Meta description generation returned empty response');
  }

  const parsed = JSON.parse(text) as { metaDescription?: string };
  const metaDescription =
    typeof parsed.metaDescription === 'string' ? parsed.metaDescription.trim() : '';

  if (!metaDescription) {
    throw new Error('Meta description generation returned empty metaDescription');
  }

  return truncateMetaDescription(metaDescription);
}

export async function resolveOptimizedMetaDescription(
  input: GenerateOptimizedMetaDescriptionInput & { existingMeta?: string | null },
  apiKey: string | undefined,
  workspaceId?: string
): Promise<string> {
  const existing = input.existingMeta?.trim() ?? '';
  const briefMeta = input.briefContent
    ? extractArticleMetadata(input.briefContent, input.targetKeyword).metaDescription?.trim()
    : '';

  if (existing && isMetaDescriptionAcceptable(existing, input.targetKeyword)) {
    return truncateMetaDescription(existing);
  }

  if (briefMeta && isMetaDescriptionAcceptable(briefMeta, input.targetKeyword)) {
    return truncateMetaDescription(briefMeta);
  }

  if (!apiKey?.trim()) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  return generateOptimizedMetaDescription(input, apiKey, workspaceId);
}

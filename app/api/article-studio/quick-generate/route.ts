import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { truncateMetaDescription } from '@/lib/article-metadata';
import { resolveOptimizedMetaDescription } from '@/lib/generate-optimized-meta-description';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an elite content copywriter and SEO strategist. Your job is to write fully structured, publication-ready Markdown articles from minimal user inputs alone — no content brief is provided.

RULES:
- Write in clear, authoritative, engaging prose with strong narrative flow.
- Use proper Markdown: one H1 title, logical H2/H3 sections, bullet lists where helpful, and bold for emphasis sparingly.
- Match the requested word count as closely as possible (±10%).
- Open with immediate value — no filler phrases like "In this article we will..."
- Include practical, actionable insights the reader can use right away.
- If style guidelines or context are provided, follow them precisely.
- End with a concise, natural conclusion or next-step CTA when appropriate.

OUTPUT FORMAT:
You must return your response strictly as a JSON object with four keys: "title" (string, the article H1 title), "seoTitle" (string), "metaDescription" (string, max 160 characters), and "content" (string, formatted in Markdown). Do not include any other text outside this JSON object. The Markdown content must start with # Title and must not repeat SEO metadata inside the body.`;

type QuickGenerateRequest = {
  title: string;
  wordCount: number;
  additionalContext?: string;
};

type QuickGenerateResponse = {
  title: string;
  seoTitle: string;
  metaDescription: string;
  content: string;
};

function truncateMetaDescriptionValue(value: string): string {
  return truncateMetaDescription(value);
}

function parseQuickGenerateResponse(rawText: string, fallbackTitle: string): QuickGenerateResponse {
  try {
    const parsed = JSON.parse(rawText) as Partial<QuickGenerateResponse>;

    if (typeof parsed.content !== 'string' || !parsed.content.trim()) {
      throw new Error('Missing content in JSON response');
    }

    const content = parsed.content.trim();
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : titleMatch?.[1]?.trim() || fallbackTitle;
    const seoTitle =
      typeof parsed.seoTitle === 'string' && parsed.seoTitle.trim()
        ? parsed.seoTitle.trim()
        : title;
    const metaDescription =
      typeof parsed.metaDescription === 'string' && parsed.metaDescription.trim()
        ? truncateMetaDescriptionValue(parsed.metaDescription)
        : '';

    return { title, seoTitle, metaDescription, content };
  } catch {
    const content = rawText.trim();
    if (!content) {
      throw new Error('Gemini returned an empty response');
    }

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() || fallbackTitle;

    return {
      title,
      seoTitle: title,
      metaDescription: '',
      content,
    };
  }
}

const WORD_COUNT_OPTIONS = [500, 800, 1000, 1200, 1500, 2000] as const;

function isQuickGenerateRequest(body: unknown): body is QuickGenerateRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as QuickGenerateRequest;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.wordCount === 'number' &&
    Number.isInteger(candidate.wordCount) &&
    candidate.wordCount > 0 &&
    (candidate.additionalContext === undefined ||
      typeof candidate.additionalContext === 'string')
  );
}

function buildUserPrompt(input: QuickGenerateRequest): string {
  const lines = [
    `Title / Keyword: ${input.title.trim()}`,
    `Target Word Count: ${input.wordCount}`,
  ];

  if (input.additionalContext?.trim()) {
    lines.push('', 'Additional Context / Style Guidelines:', input.additionalContext.trim());
  }

  return lines.join('\n');
}

function normalizeWordCount(value: number): number {
  if (WORD_COUNT_OPTIONS.includes(value as (typeof WORD_COUNT_OPTIONS)[number])) {
    return value;
  }

  return WORD_COUNT_OPTIONS.reduce((closest, option) =>
    Math.abs(option - value) < Math.abs(closest - value) ? option : closest
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isQuickGenerateRequest(body)) {
    return NextResponse.json(
      { error: 'title and wordCount are required' },
      { status: 400 }
    );
  }

  const title = body.title.trim();
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const wordCount = normalizeWordCount(body.wordCount);
  const additionalContext = body.additionalContext;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    let workspaceId = 'system:anonymous';
    try {
      workspaceId = await getAuthenticatedWorkspaceId();
    } catch (error) {
      if (!isUnauthenticatedError(error)) throw error;
    }

    return await withBackgroundTask(
      {
        userId: workspaceId,
        taskType: 'QUICK_ARTICLE_GENERATION',
        metadata: { title, wordCount },
      },
      async () => {
        const ai = new GoogleGenAI({ apiKey });

        const response = await withIntegrationTelemetry(
          {
            integrationType: 'GEMINI',
            targetUrl: 'gemini-2.5-flash',
            workspaceId,
            operation: 'quick_article_generation',
          },
          () =>
            ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: buildUserPrompt({
                title,
                wordCount,
                additionalContext,
              }),
              config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                responseJsonSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    seoTitle: { type: Type.STRING },
                    metaDescription: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ['title', 'seoTitle', 'metaDescription', 'content'],
                },
              },
            })
        );

        const text = response.text?.trim();
        if (!text) {
          return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 500 });
        }

        const parsed = parseQuickGenerateResponse(text, title);

        const metaDescription = await resolveOptimizedMetaDescription(
          {
            targetKeyword: title,
            seoTitle: parsed.seoTitle,
            articleContent: parsed.content,
            existingMeta: parsed.metaDescription,
          },
          apiKey,
          workspaceId
        );

        return NextResponse.json({
          title: parsed.title,
          seoTitle: parsed.seoTitle,
          metaDescription,
          content: parsed.content,
          wordCount,
        });
      }
    );
  } catch (error) {
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : 'Quick article generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

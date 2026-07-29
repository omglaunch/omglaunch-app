import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { truncateMetaDescription } from '@/lib/article-metadata';
import { resolveOptimizedMetaDescription } from '@/lib/generate-optimized-meta-description';
import { prisma } from '@/lib/prisma';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a World-Class Authority and Subject Matter Expert in the field corresponding to the [Target Keyword]. Your mission is to provide the most authoritative, semantically rich, and comprehensive content on the web, fully optimized for Generative Engine Optimization (GEO).

CRITICAL TONE & STYLE GUIDELINES:
- LOCAL AUTHORITY (GEO-SEO): Do not just append a city or country name to a sentence to check a box. If the topic has local relevance, you must demonstrate hyper-local expertise by name-dropping actual, real-world regional examples specific to the niche of the [Target Keyword]. For example: if writing about recreation, name specific local trails/parks; if weddings/events, name iconic local luxury venues or neighborhoods; if a local service, reference specific regional climates, local regulations, or neighborhood dynamics. Google and generative engines reward highly specific geographic footprint signals.
- OPINIONATED AUTHORITY: Don't just list options. Make a recommendation. Tell the reader what *you* would choose and why. 
- FIRST-PERSON EXPERTISE: Write as a seasoned veteran speaking to a smart colleague. Use 'I,' 'My,' or 'Our' to frame your insights (e.g., 'In my experience...', 'I always recommend...').
- THE 'DIRECT ANSWER' FRAMEWORK: AI search engines evaluate content in chunks. Immediately under every H2 or H3 heading, provide a concise, 1-2 sentence direct answer or TL;DR before expanding into the deeper context.
- ENTITY CLARITY (ZERO VAGUE PRONOUNS): Absolutely forbid starting sentences or clauses with vague pronouns or weak transitional pointers like "This is where...", "It allows you to...", "These are...", or "It democratizes...". Generative search models drop citations when the subject context is lost in a passage chunk. You must explicitly replace pronouns with the concrete noun or entity name (e.g., instead of "This allows you to save money", write "Choosing a rental package allows you to save money"; instead of "It performs exceptionally in the humidity", write "The breathable synthetic fabric performs exceptionally in the humidity").
- VISUAL SYNTAX LAYOUT (STRICT IMAGE URL MAPPING): Do not use generic '*Image Placeholder*' text markers. You must parse the exact Image URLs and matching Alt Text themes provided in Section 7 of the Content Brief. Embed them natively throughout the body text using the exact Markdown image syntax format: \`![Suggested Alt Text Theme](Actual_URL_From_Brief)\`.
- SEMANTIC INTEGRATION (NLP & LSI): Perform 'Entity Relationship Mapping.' Explain how the provided NLP Entities relate to the Primary Keyword. 
- CO-OCCURRENCE DEPTH: Include the 'silent' vocabulary of the niche (e.g., if writing about hiking, discuss 'blister prevention' or 'gear weight distribution') even if not in the brief.
- DEMONSTRABLE E-E-A-T: Provide 'insider' nuances that only a veteran would know (e.g., specific gear failures you've witnessed, maintenance hacks).
- NO GENERIC FILLER: Avoid introductory fluff. Start directly with the core value.
- STRUCTURE: Strictly follow the H2/H3/H4 hierarchy from the brief.
- ACTIONABLE: Every section must provide clear 'how-to' advice, data-driven insights, or step-by-step logic.
- FORMATTING: Use Markdown. Include natural Call-to-Action (CTA) links.

INSTRUCTIONS:
1. Analyze the Content Brief and the [Target Keyword].
2. Assume the specific identity of the leading authority in this niche.
3. Inject local context where applicable to improve GEO ranking.
4. Draft the article, ensuring every section starts with a clear, extractable answer.
5. Map every image URL provided in Section 7 of the brief to its corresponding section in the article body using real \`![Alt Text](URL)\` markdown. Never omit the source link.

You must return your response strictly as a JSON object with three keys: 'seoTitle' (string), 'metaDescription' (string, max 160 characters — must be a GEO-optimized SERP snippet with the primary keyword in the first 120 characters, concrete entities, and a clear value hook; never generic filler), and 'content' (string, formatted in Markdown). Do not include any other text outside this JSON object. The Markdown content must start with a single H1 title and must not repeat SEO metadata inside the body.`;

type GenerateArticleRequest = {
  briefId: number;
};

type GeneratedArticlePayload = {
  seoTitle: string;
  metaDescription: string;
  content: string;
};

function isGenerateArticleRequest(body: unknown): body is GenerateArticleRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as GenerateArticleRequest).briefId === 'number' &&
    Number.isInteger((body as GenerateArticleRequest).briefId) &&
    (body as GenerateArticleRequest).briefId > 0
  );
}

function extractTitleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function truncateMetaDescriptionValue(value: string): string {
  return truncateMetaDescription(value);
}

function parseGeneratedArticlePayload(
  rawText: string,
  fallbackTitle: string
): GeneratedArticlePayload {
  try {
    const parsed = JSON.parse(rawText) as Partial<GeneratedArticlePayload>;

    if (typeof parsed.content !== 'string' || !parsed.content.trim()) {
      throw new Error('Missing content in JSON response');
    }

    const content = parsed.content.trim();
    const seoTitle =
      typeof parsed.seoTitle === 'string' && parsed.seoTitle.trim()
        ? parsed.seoTitle.trim()
        : extractTitleFromMarkdown(content, fallbackTitle);
    const metaDescription =
      typeof parsed.metaDescription === 'string' && parsed.metaDescription.trim()
        ? truncateMetaDescriptionValue(parsed.metaDescription)
        : '';

    return { seoTitle, metaDescription, content };
  } catch {
    const content = rawText.trim();
    if (!content) {
      throw new Error('Gemini returned an empty response');
    }

    const seoTitle = extractTitleFromMarkdown(content, fallbackTitle);

    return {
      content,
      seoTitle,
      metaDescription: '',
    };
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateArticleRequest(body)) {
    return NextResponse.json({ error: 'briefId is required' }, { status: 400 });
  }

  const { briefId } = body;

  const brief = await prisma.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    return NextResponse.json({ error: 'Content brief not found' }, { status: 404 });
  }

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
        taskType: 'ARTICLE_GENERATION',
        metadata: { briefId },
      },
      async () => {
        const ai = new GoogleGenAI({ apiKey });

        const userPrompt = [
          `Target Keyword: ${brief.targetKeyword}`,
          `Target URL: ${brief.targetUrl}`,
          '',
          'Content Brief:',
          brief.content,
        ].join('\n');

        const response = await withIntegrationTelemetry(
          {
            integrationType: 'GEMINI',
            targetUrl: 'gemini-2.5-flash',
            workspaceId,
            operation: 'article_generation',
          },
          () =>
            ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: userPrompt,
              config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                responseJsonSchema: {
                  type: Type.OBJECT,
                  properties: {
                    seoTitle: { type: Type.STRING },
                    metaDescription: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ['seoTitle', 'metaDescription', 'content'],
                },
              },
            })
        );

        const text = response.text?.trim();
        if (!text) {
          return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 500 });
        }

        const generated = parseGeneratedArticlePayload(text, brief.targetKeyword);
        const title = extractTitleFromMarkdown(generated.content, brief.targetKeyword);

        const metaDescription = await resolveOptimizedMetaDescription(
          {
            targetKeyword: brief.targetKeyword,
            seoTitle: generated.seoTitle,
            articleContent: generated.content,
            briefContent: brief.content,
            existingMeta: generated.metaDescription,
          },
          apiKey,
          workspaceId
        );

        const article = await prisma.article.upsert({
          where: { briefId: brief.id },
          create: {
            briefId: brief.id,
            title,
            content: generated.content,
          },
          update: {
            title,
            content: generated.content,
          },
        });

        return NextResponse.json({
          article,
          seoTitle: generated.seoTitle,
          metaDescription,
        });
      }
    );
  } catch (error) {
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : 'Article generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

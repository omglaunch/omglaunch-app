import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { fetchKeywordAuditSeoMetrics } from '@/lib/keyword-audit/dataforseo';
import { buildGeoContextLabel, normalizeGeoInput } from '@/lib/keyword-audit/geo';
import { parseKeywordAuditJson } from '@/lib/types/keyword-audit';
import { isLabsBudgetExceededError } from '@/lib/silo-builder/labs-budget';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an elite enterprise SERP strategist and reverse-engineering specialist. Your job is to dissect a single target keyword and deliver a programmatic content blueprint — not generic SEO advice.

## MANDATORY ANALYSIS DEPTH
- Reverse-engineer the dominant SERP for THIS exact keyword in the specified geo context: infer the winning page format, depth signals, and entity coverage from how Google likely interprets the query in that market.
- Every field must be keyword-specific and localized to the provided country/city/language/device context. Ban vague phrases like "create quality content", "optimize for users", or "build backlinks".
- recommendedFormat must name a concrete deliverable (e.g., "Interactive ROI Calculator with 6 input fields", "4,200-word Pillar with comparison matrix + FAQ schema", "Step-by-Step Tutorial with annotated screenshots").
- targetWordCount must be a specific integer grounded in SERP depth for this query (not a round default like 1500 unless justified).
- userIntentCore: one decisive sentence stating the searcher's primary objective for THIS keyword in THIS market.
- corePainPoints: exactly 3 distinct, keyword-specific friction points the searcher faces before converting or completing their task.
- requiredSubtopics: 6–10 headings (H2/H3) that mirror mandatory semantic entities for topical authority on THIS keyword. Each purpose explains why that entity is non-optional.
- serpFeaturesToTarget: 3–6 concrete SERP features this keyword's SERP typically surfaces (Featured Snippet, People Also Ask, Video Carousel, Local Pack, etc.) — only those plausibly winnable for this query.

## OUTPUT
Return strict JSON only matching the schema. No markdown fences, no commentary, no preamble.`;

type GenerateKeywordAuditRequest = {
  keyword: string;
  country?: string;
  city?: string;
  language?: string;
  device?: string;
  workspaceId?: string;
  forceRefresh?: boolean;
};

function isGenerateKeywordAuditRequest(body: unknown): body is GenerateKeywordAuditRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as GenerateKeywordAuditRequest;
  return typeof candidate.keyword === 'string';
}

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    keyword: {
      type: Type.STRING,
      description: 'The target keyword being audited',
    },
    recommendedFormat: {
      type: Type.STRING,
      description:
        'Concrete content format (e.g., Interactive Calculator, In-Depth Comparison Table, 3,000-word Pillar)',
    },
    targetWordCount: {
      type: Type.INTEGER,
      description: 'Specific data-backed word count estimate for ranking parity',
    },
    userIntentCore: {
      type: Type.STRING,
      description: 'One clear sentence on the primary searcher objective',
    },
    corePainPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exactly three keyword-specific pain points',
    },
    requiredSubtopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: {
            type: Type.STRING,
            description: 'Suggested H2/H3 tag text',
          },
          purpose: {
            type: Type.STRING,
            description: 'Why this semantic entity is mandatory for topical authority',
          },
        },
        required: ['heading', 'purpose'],
      },
    },
    serpFeaturesToTarget: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'SERP features to target (Featured Snippet, PAA, Video Carousel, etc.)',
    },
  },
  required: [
    'keyword',
    'recommendedFormat',
    'targetWordCount',
    'userIntentCore',
    'corePainPoints',
    'requiredSubtopics',
    'serpFeaturesToTarget',
  ],
};

function buildUserPrompt(keyword: string, geo: ReturnType<typeof normalizeGeoInput>): string {
  return [
    `Target keyword: ${keyword}`,
    `Geo context: ${buildGeoContextLabel(geo)}`,
    '',
    'Reverse-engineer the localized SERP and deliver a programmatic content blueprint with concrete metrics and mandatory subtopics.',
    'Avoid generic SEO advice — every output field must be specific to this keyword and market.',
  ].join('\n');
}

const MAX_GEMINI_ATTEMPTS = 3;

async function generateKeywordAuditContent(
  ai: GoogleGenAI,
  keyword: string,
  geo: ReturnType<typeof normalizeGeoInput>
): Promise<ReturnType<typeof parseKeywordAuditJson>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    const llmResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildUserPrompt(keyword, geo),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });

    const text = llmResponse.text?.trim();
    if (!text) {
      lastError = new Error('Gemini returned an empty response');
      continue;
    }

    try {
      return parseKeywordAuditJson(text, keyword);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Invalid Gemini response');
      console.warn(
        `[keyword-audit] Gemini schema mismatch on attempt ${attempt}/${MAX_GEMINI_ATTEMPTS}:`,
        lastError.message
      );
    }
  }

  throw lastError ?? new Error('Keyword audit generation failed');
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateKeywordAuditRequest(body)) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  const keyword = body.keyword.trim();

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  const geo = normalizeGeoInput({
    country: body.country,
    city: body.city,
    language: body.language,
    device: body.device,
  });
  const forceRefresh = body.forceRefresh === true;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const [seoMetrics, parsed] = await Promise.all([
      fetchKeywordAuditSeoMetrics(keyword, geo, {
        workspaceId: body.workspaceId,
        forceRefresh,
      }),
      generateKeywordAuditContent(ai, keyword, geo),
    ]);

    const dataForSeoFromCache = Boolean(
      seoMetrics?.fromCache?.metrics || seoMetrics?.fromCache?.serp
    );

    return NextResponse.json({
      ...parsed,
      keyword,
      country: geo.country,
      city: geo.city,
      language: geo.language,
      device: geo.device,
      searchVolume: seoMetrics?.searchVolume ?? null,
      keywordDifficulty: seoMetrics?.keywordDifficulty ?? null,
      topCompetitors: seoMetrics?.topCompetitors ?? [],
      dataForSeoFromCache,
    });
  } catch (error) {
    if (isLabsBudgetExceededError(error)) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message =
      error instanceof Error ? error.message : 'Keyword audit generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

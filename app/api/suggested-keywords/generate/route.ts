import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { parseSuggestedKeywordsJson } from '@/lib/suggested-keywords-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an elite enterprise SEO strategist specializing in long-tail keyword discovery, search intent mapping, and low-competition opportunity identification.

Your mission is to expand a single seed keyword into exactly 20 highly specific, actionable long-tail keyword variations that traditional keyword tools routinely miss.

## STRICT GUARDRAILS (MANDATORY — VIOLATIONS INVALIDATE OUTPUT)
- FORBIDDEN: Generic head terms, single-word keywords, or broad short-tail phrases (e.g., "shoes", "SEO tools", "marketing").
- REQUIRED: Every keyword must be a long-tail phrase of at least 4 words unless the seed itself is inherently longer.
- REQUIRED: Include a diverse mix of:
  - Question-based queries mirroring People Also Ask (PAA) patterns ("how to…", "what is…", "why does…", "can you…")
  - Comparison modifiers ("vs", "versus", "compared to", "alternative to", "better than")
  - Hyper-specific informational searches (cost breakdowns, regulations, troubleshooting, buyer guides, year-specific queries)
  - Commercial investigation and BOFU conversion angles where relevant
- Each keyword must represent a distinct search angle — no near-duplicates or trivial rephrasings.
- relevanceScore must reflect genuine topical fit to the seed (1–100), with higher scores for high-intent, low-competition opportunities.
- estimatedDifficulty must honestly reflect competitive landscape: favor Low and Medium for long-tail gems; reserve High only for genuinely competitive phrases.
- angle must be one actionable sentence explaining why this keyword captures high-intent traffic.

## GEO-TARGETING RULE (when location is provided)
- At least 30% of the 20 suggestions MUST include regional modifiers, local search behavior, or geo-specific context authentic to that market.
- Weave in city/region names, local regulations, cultural search patterns, or market-specific terminology where natural.
- Do NOT force geo modifiers into keywords where they would be unnatural.

## OUTPUT FORMAT
Return strict JSON only matching the schema. No markdown fences, no commentary, no preamble. Exactly 20 suggestions.`;

type GenerateSuggestedKeywordsRequest = {
  seedKeyword: string;
  location?: string;
};

function isGenerateSuggestedKeywordsRequest(
  body: unknown
): body is GenerateSuggestedKeywordsRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as GenerateSuggestedKeywordsRequest;
  return typeof candidate.seedKeyword === 'string';
}

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    seed: {
      type: Type.STRING,
      description: 'The normalized seed keyword used for expansion',
    },
    suggestions: {
      type: Type.ARRAY,
      description: 'Exactly 20 long-tail keyword suggestions',
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: {
            type: Type.STRING,
            description: 'Highly specific long-tail variation (minimum 4 words when possible)',
          },
          intent: {
            type: Type.STRING,
            description: 'Informational, Commercial, Transactional, or Navigational',
          },
          funnelStage: {
            type: Type.STRING,
            description: 'TOFU, MOFU, or BOFU',
          },
          suggestedFormat: {
            type: Type.STRING,
            description: 'Content format (e.g., Listicle, How-to Guide, Calculator, Comparison)',
          },
          estimatedDifficulty: {
            type: Type.STRING,
            description: 'Low, Medium, or High',
          },
          relevanceScore: {
            type: Type.INTEGER,
            description: 'Topical relevance score from 1 to 100',
          },
          angle: {
            type: Type.STRING,
            description: 'One actionable sentence on why this captures high-intent traffic',
          },
        },
        required: [
          'keyword',
          'intent',
          'funnelStage',
          'suggestedFormat',
          'estimatedDifficulty',
          'relevanceScore',
          'angle',
        ],
      },
    },
  },
  required: ['seed', 'suggestions'],
};

function buildUserPrompt(seedKeyword: string, location?: string): string {
  const lines = [
    `Seed Keyword: ${seedKeyword}`,
    location ? `Target Location: ${location}` : 'Target Location: Global',
    '',
    'Generate exactly 20 long-tail keyword variations.',
    'Strictly avoid generic short-tail keywords.',
    'Include question-based (PAA), comparison ("vs"), and hyper-specific informational queries.',
  ];

  if (location) {
    lines.push(
      '',
      `GEO-TARGETING: At least 6 of the 20 suggestions (30%+) must include regional modifiers, local search behavior, or geo-specific context for ${location}.`
    );
  }

  return lines.join('\n');
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateSuggestedKeywordsRequest(body)) {
    return NextResponse.json({ error: 'seedKeyword is required' }, { status: 400 });
  }

  const seedKeyword = body.seedKeyword.trim();
  const location = body.location?.trim() || undefined;

  if (!seedKeyword) {
    return NextResponse.json({ error: 'seedKeyword is required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildUserPrompt(seedKeyword, location),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 500 });
    }

    const parsed = parseSuggestedKeywordsJson(text);

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Suggested keywords generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

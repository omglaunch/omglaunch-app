import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { parseQueryComparisonJson } from '@/lib/query-comparison-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an elite enterprise SEO strategist specializing in search intent analysis, keyword cannibalization prevention, and content architecture decisions.

Your mission is to compare two search queries and deliver a definitive strategic verdict on whether they should target the same page or separate pages.

## CORE EVALUATION LOGIC (MANDATORY)
- Determine if the queries share **identical searcher intent** (same psychological goal, same page target) OR represent **different user mindsets/funnel stages** (separate page targets).
- overlapScore (0–100): 100 = identical intent; 0 = completely different intents. Avoid lazy 50% mid-scores unless the queries genuinely sit at a true ambiguity boundary.
- intentMatch: true ONLY when both queries should rank on the same URL/page; false when they warrant separate pillar or supporting pages.
- cannibalizationRisk: assess risk if both were forced onto one page without proper structure (Low / Medium / High).

## DECISIVE STANCE (MANDATORY)
- Take a clear, actionable position. Enterprise SEO requires conviction — not hedging.
- recommendation must be one definitive sentence (e.g., "Target on the same page with a dedicated H2 for Query B" or "Build separate pillar pages — Query A is educational, Query B is transactional").
- detailedAnalysis: 3–4 sentences explaining the psychological intent behind each query and why they overlap or diverge.

## FUNNEL STAGING (DECISIVE — NO DEFAULT TO MOFU)
- Classify each query as TOFU (awareness/education), MOFU (consideration/comparison), or BOFU (purchase/conversion/action).
- Be decisive — avoid lazy MOFU defaults when intent signals are clear.
- High-intent, high-ticket human service queries lean heavily into BOFU: hiring language ("consultant", "agency", "expert", "specialist"), local/action modifiers ("near me", "in [city]", "hire", "book", "quote", "pricing"), and direct provider-selection queries.
- Pure educational or definitional queries without commercial/action signals are TOFU; comparison/evaluation without purchase intent is MOFU.

## SERP EXPECTATIONS
- serpLayoutExpectation: one brief sentence describing expected SERP features for these queries (e.g., Local Map Pack vs informational featured snippets, video carousels, shopping panels).

## OUTPUT FORMAT
Return strict JSON only matching the schema. No markdown fences, no commentary, no preamble.`;

type GenerateQueryComparisonRequest = {
  queryA: string;
  queryB: string;
};

function isGenerateQueryComparisonRequest(body: unknown): body is GenerateQueryComparisonRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as GenerateQueryComparisonRequest;
  return typeof candidate.queryA === 'string' && typeof candidate.queryB === 'string';
}

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    queryA: {
      type: Type.STRING,
      description: 'The first query being compared',
    },
    queryB: {
      type: Type.STRING,
      description: 'The second query being compared',
    },
    overlapScore: {
      type: Type.INTEGER,
      description: 'Intent overlap from 0 (completely different) to 100 (identical intent)',
    },
    intentMatch: {
      type: Type.BOOLEAN,
      description: 'True if both queries should target the same page',
    },
    cannibalizationRisk: {
      type: Type.STRING,
      description: 'Low, Medium, or High',
    },
    funnelComparison: {
      type: Type.OBJECT,
      properties: {
        queryAStage: {
          type: Type.STRING,
          description: 'TOFU, MOFU, or BOFU',
        },
        queryBStage: {
          type: Type.STRING,
          description: 'TOFU, MOFU, or BOFU',
        },
      },
      required: ['queryAStage', 'queryBStage'],
    },
    serpLayoutExpectation: {
      type: Type.STRING,
      description: 'One brief sentence on expected SERP features',
    },
    recommendation: {
      type: Type.STRING,
      description: 'One definitive strategic directive sentence',
    },
    detailedAnalysis: {
      type: Type.STRING,
      description: '3–4 sentence strategic breakdown of intent overlap or divergence',
    },
  },
  required: [
    'queryA',
    'queryB',
    'overlapScore',
    'intentMatch',
    'cannibalizationRisk',
    'funnelComparison',
    'serpLayoutExpectation',
    'recommendation',
    'detailedAnalysis',
  ],
};

function buildUserPrompt(queryA: string, queryB: string): string {
  return [
    `Query A: ${queryA}`,
    `Query B: ${queryB}`,
    '',
    'Compare these two queries for intent overlap, funnel stage, cannibalization risk, and page targeting strategy.',
    'Take a definitive stance — avoid ambiguous mid-scores unless genuinely warranted.',
  ].join('\n');
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateQueryComparisonRequest(body)) {
    return NextResponse.json({ error: 'queryA and queryB are required' }, { status: 400 });
  }

  const queryA = body.queryA.trim();
  const queryB = body.queryB.trim();

  if (!queryA || !queryB) {
    return NextResponse.json({ error: 'queryA and queryB are required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildUserPrompt(queryA, queryB),
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

    const parsed = parseQueryComparisonJson(text);

    return NextResponse.json({
      ...parsed,
      queryA,
      queryB,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Query comparison generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import {
  deductCredits,
  isInsufficientCreditsError,
} from '@/lib/credits';
import { isHubSpokeMap, normalizeHubSpokeMap, type HubSpokeMap } from '@/lib/hub-spoke-data';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { fetchClusterKeywordMetricsBatch } from '@/lib/topical-map/dataforseo-metrics';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import {
  assertLabsBudget,
  estimateLabsTasksForKeywords,
  isLabsBudgetExceededError,
} from '@/lib/silo-builder/labs-budget';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LOCATION = 'Malaysia';
const TOPICAL_MAP_GENERATION_COST = 50;

const SYSTEM_PROMPT = `You are an elite enterprise SEO strategist specializing in Hub & Spoke topical architecture, Generative Engine Optimization (GEO), and regional search dominance.

Your mission is to design a bulletproof topical map from a single seed keyword: one Core Pillar Page and exactly 8 to 9 Supporting Cluster Pages that establish unassailable topical authority.

## ENTITY CLARITY RULES (MANDATORY)
- Every summary must use concrete nouns, named concepts, and specific subject matter. Never use vague pronouns ("it", "this", "they") without an explicit antecedent in the same sentence.
- Never use ambiguous transitions such as "this is because", "that's why", "which means", or "as such" without naming the exact cause and effect.
- Each summary must stand alone: a reader must know precisely which topic, audience, and outcome the page addresses without guessing.

## LOCAL AUTHORITY RULES (when a location is provided)
- Weave specific, real-world regional context into titles, keywords, and summaries where natural.
- Reference venue archetypes, local market dynamics, regulatory environments, climate factors, cultural search behavior, or geographic modifiers authentic to that region.
- Avoid generic global copy when a location is specified. Malaysia means Klang Valley logistics, tropical humidity impacts, B40/M40 consumer segments, Shopee/Lazada commerce behavior, etc.—only when relevant to the seed keyword.

## ARCHITECTURE REQUIREMENTS
- The pillar must function as the ultimate guide H1: broad enough to anchor the silo, specific enough to rank for the head term plus local modifiers when applicable.
- Clusters must cover distinct long-tail angles: comparison queries, how-to guides, cost/pricing, regulations, troubleshooting, buyer guides, location-specific variants, and BOFU conversion pages.
- Distribute funnel stages deliberately: mix TOFU (awareness), MOFU (consideration), and BOFU (conversion/decision) across clusters.
- Each cluster must include hyper-optimized anchorTextToPillar—the exact anchor text that would link back to the pillar in a published article.
- Each cluster must include lateralLinks: an array of 1 to 2 objects referencing OTHER cluster titles from this same generation (not the pillar). Each lateral link must include spokeTitle (exact title of the related cluster article) and suggestedLateralAnchorText (natural in-body anchor text for that spoke-to-spoke link).
- Lateral links must form a cohesive internal linking mesh—every cluster should connect to at least one complementary angle within the silo.
- semanticEntities must contain 3 to 5 mandatory NLP keywords/entities tightly coupled to that cluster's specific angle (proper nouns, product categories, technical terms, local entities).
- primaryCallToAction on the pillar must state the ultimate commercial conversion goal for the entire silo (e.g., book a consultation, request a quote, start a free trial).

## OUTPUT FORMAT
Return strict JSON only. No markdown fences, no commentary, no preamble.`;

type GenerateHubSpokeRequest = {
  seedKeyword: string;
  location?: string;
  workspaceId?: string;
  projectId?: string;
};

function isGenerateHubSpokeRequest(body: unknown): body is GenerateHubSpokeRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as GenerateHubSpokeRequest;
  return typeof candidate.seedKeyword === 'string';
}

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pillar: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description:
            'The ultimate guide H1 optimized for search and local context',
        },
        targetKeyword: { type: Type.STRING },
        summary: {
          type: Type.STRING,
          description:
            '1-2 sentences using concrete nouns to outline what this core page covers',
        },
        primaryCallToAction: {
          type: Type.STRING,
          description:
            'The ultimate commercial conversion goal for this pillar silo',
        },
      },
      required: ['title', 'targetKeyword', 'summary', 'primaryCallToAction'],
    },
    clusters: {
      type: Type.ARRAY,
      description: 'Exactly 8 to 9 supporting cluster pages',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description:
              'Specific long-tail H1 matching user search behavior',
          },
          targetKeyword: { type: Type.STRING },
          funnelStage: {
            type: Type.STRING,
            description: 'TOFU, MOFU, or BOFU',
          },
          searchIntent: {
            type: Type.STRING,
            description:
              'Informational, Commercial, Transactional, or Navigational',
          },
          anchorTextToPillar: {
            type: Type.STRING,
            description:
              'Exact hyper-optimized anchor text linking back to the pillar page',
          },
          lateralLinks: {
            type: Type.ARRAY,
            description:
              '1-2 spoke-to-spoke lateral links to other cluster titles in this map',
            items: {
              type: Type.OBJECT,
              properties: {
                spokeTitle: {
                  type: Type.STRING,
                  description: 'Exact title of the related cluster article',
                },
                suggestedLateralAnchorText: {
                  type: Type.STRING,
                  description: 'Natural anchor text for the lateral spoke link',
                },
              },
              required: ['spokeTitle', 'suggestedLateralAnchorText'],
            },
          },
          semanticEntities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3-5 mandatory NLP keywords/entities for this cluster',
          },
          summary: {
            type: Type.STRING,
            description:
              '1-2 sentences on the exact strategic angle of this supporting article',
          },
        },
        required: [
          'title',
          'targetKeyword',
          'funnelStage',
          'searchIntent',
          'anchorTextToPillar',
          'lateralLinks',
          'semanticEntities',
          'summary',
        ],
      },
    },
  },
  required: ['pillar', 'clusters'],
};

function buildUserPrompt(seedKeyword: string, location: string): string {
  return [
    `Seed Keyword: ${seedKeyword}`,
    `Target Location: ${location}`,
    '',
    'Generate a complete Hub & Spoke topical map with exactly 8 to 9 cluster pages.',
    'Ensure internal linking logic is explicit: every cluster anchorTextToPillar must naturally point readers to the pillar guide.',
    'Every cluster must include 1-2 lateralLinks referencing other cluster titles from this same generation with natural suggestedLateralAnchorText.',
    location !== 'Global'
      ? `Optimize all titles, keywords, and summaries for ${location} search behavior and local authority signals.`
      : 'Optimize for global English search behavior with internationally applicable entities.',
  ].join('\n');
}

async function enrichMapWithMetrics(
  map: HubSpokeMap,
  location: string,
  workspaceId?: string
): Promise<HubSpokeMap> {
  const keywords = map.clusters.map(cluster => cluster.targetKeyword);

  if (workspaceId?.trim()) {
    await assertLabsBudget(
      workspaceId,
      estimateLabsTasksForKeywords(keywords.length)
    );
  }

  const metricsByKeyword = await fetchClusterKeywordMetricsBatch(
    keywords,
    location,
    workspaceId
  );

  return {
    ...map,
    clusters: map.clusters.map(cluster => {
      const metrics = metricsByKeyword.get(cluster.targetKeyword) ?? {
        searchVolume: null,
        keywordDifficulty: null,
      };

      return {
        ...cluster,
        searchVolume: metrics.searchVolume,
        keywordDifficulty: metrics.keywordDifficulty,
        status: 'Draft' as const,
      };
    }),
  };
}

async function generateMapFromGemini(
  ai: GoogleGenAI,
  seedKeyword: string,
  location: string,
  attempt: number,
  workspaceId: string
): Promise<HubSpokeMap | null> {
  const emphasis =
    attempt > 1
      ? '\n\nCRITICAL: Return exactly 8 or 9 cluster objects. Every cluster MUST include lateralLinks (1-2 items) and semanticEntities (3-5 items).'
      : '';

  const response = await withIntegrationTelemetry(
    {
      integrationType: 'GEMINI',
      targetUrl: 'gemini-2.5-flash',
      workspaceId,
      operation: `hub_spoke_generation_attempt_${attempt}`,
    },
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildUserPrompt(seedKeyword, location) + emphasis,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
        },
      })
  );

  const text = response.text?.trim();
  if (!text) {
    return null;
  }

  const parsed = JSON.parse(text) as unknown;
  const normalized = normalizeHubSpokeMap(parsed);

  if (!normalized || !isHubSpokeMap(normalized)) {
    return null;
  }

  return normalized;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateHubSpokeRequest(body)) {
    return NextResponse.json({ error: 'seedKeyword is required' }, { status: 400 });
  }

  const seedKeyword = body.seedKeyword.trim();
  const location = (body.location?.trim() || DEFAULT_LOCATION).trim();
  const workspaceId = body.workspaceId?.trim() || body.projectId?.trim();

  if (!seedKeyword) {
    return NextResponse.json({ error: 'seedKeyword is required' }, { status: 400 });
  }

  let userId: string;

  try {
    userId = await getAuthenticatedWorkspaceId();
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    return await withBackgroundTask(
      {
        userId,
        taskType: 'HUB_SPOKE_GENERATION',
        metadata: { seedKeyword, location },
      },
      async () => {
        await deductCredits(userId, TOPICAL_MAP_GENERATION_COST, 'TOPICAL_MAP_GENERATION');

        const ai = new GoogleGenAI({ apiKey });

        let parsed: HubSpokeMap | null = null;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          parsed = await generateMapFromGemini(ai, seedKeyword, location, attempt, userId);
          if (parsed) {
            break;
          }
        }

        if (!parsed) {
          return NextResponse.json(
            {
              error:
                'Generated map did not match the required schema (8-10 clusters with lateral links and 3-5 entities each)',
            },
            { status: 500 }
          );
        }

        const enrichedMap = await enrichMapWithMetrics(parsed, location, workspaceId);

        return NextResponse.json({ map: enrichedMap });
      }
    );
  } catch (error) {
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (isLabsBudgetExceededError(error)) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (isInsufficientCreditsError(error)) {
      return NextResponse.json(
        { error: 'Insufficient credits to generate map.' },
        { status: 402 }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Hub & Spoke map generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

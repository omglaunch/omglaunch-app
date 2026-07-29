import { GoogleGenAI, Type } from '@google/genai';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { normalizeHubSpokeMap } from '@/lib/hub-spoke-data';
import { hubSpokeMapToKeywordSilo } from '@/lib/silo-builder/hub-spoke-convert';
import { resolveKeywordSiloNiche } from '@/lib/silo-builder/resolve-niche';
import { SILO_GEMINI_MODEL } from '@/lib/silo-builder/constants';
import type { SiloKeywordMapResult } from '@/lib/silo-builder/types';

const KEYWORD_SYSTEM_PROMPT = `You are an elite SEO silo architect specializing in Hub & Spoke topical authority.

Design a semantic silo from the user's seed keyword: exactly 1 Core Pillar Page and 5 to 15 Supporting Spoke pages.

Requirements:
- Pillar must anchor the entire silo with broad topical authority and a compelling summary.
- Spokes must cover distinct long-tail angles with clear semantic relationships to the pillar.
- Each cluster must include funnelStage (TOFU, MOFU, or BOFU), searchIntent, anchorTextToPillar, 1-2 lateralLinks to other cluster titles, 3-5 semanticEntities, and a summary.
- targetKeyword must be a literal Google search query (2-5 words), not an editorial phrase. Prefer competitor keyword vocabulary when relevant.
- lateralLinks must reference exact spoke titles from your cluster list.
- Return strict JSON only. No markdown fences, no commentary.`;

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pillar: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        targetKeyword: { type: Type.STRING },
        summary: { type: Type.STRING },
        primaryCallToAction: { type: Type.STRING },
      },
      required: ['title', 'targetKeyword', 'summary', 'primaryCallToAction'],
    },
    clusters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          targetKeyword: { type: Type.STRING },
          funnelStage: { type: Type.STRING },
          searchIntent: { type: Type.STRING },
          anchorTextToPillar: { type: Type.STRING },
          lateralLinks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                spokeTitle: { type: Type.STRING },
                suggestedLateralAnchorText: { type: Type.STRING },
              },
              required: ['spokeTitle', 'suggestedLateralAnchorText'],
            },
          },
          semanticEntities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          summary: { type: Type.STRING },
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

function buildUserPrompt(
  seedKeyword: string,
  niche: string,
  geography: string | undefined,
  nicheWasProvided: boolean
): string {
  const audienceLine = nicheWasProvided
    ? `Niche / Target Audience: ${niche}`
    : `Niche / Target Audience: ${niche} (infer angles, intent, and titles from the seed keyword and geography).`;

  return [
    `Seed Keyword: ${seedKeyword}`,
    audienceLine,
    geography ? `Target Geography: ${geography}` : '',
    '',
    'Architect a Hub & Spoke topical map with 1 pillar and 5-15 clusters. Each cluster needs anchor text to the pillar, lateral links to sibling spokes, and semantic entities.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateKeywordSiloMap(
  workspaceId: string,
  seedKeyword: string,
  niche?: string,
  geography?: string
): Promise<SiloKeywordMapResult> {
  const nicheWasProvided = Boolean(niche?.trim());
  const resolvedNiche = resolveKeywordSiloNiche(seedKeyword, niche);
  const cred = await resolveLlmCredential(workspaceId, 'gemini');
  if (!cred) {
    throw new Error('Gemini API credentials are not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: cred.apiKey });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const emphasis =
      attempt > 1
        ? '\n\nCRITICAL: Return 5-15 clusters with lateralLinks and semanticEntities. Every cluster needs anchorTextToPillar and summary.'
        : '';

    const response = await withIntegrationTelemetry(
      {
        integrationType: 'GEMINI',
        targetUrl: SILO_GEMINI_MODEL,
        workspaceId,
        operation: `silo_keyword_map_attempt_${attempt}`,
      },
      () =>
        ai.models.generateContent({
          model: SILO_GEMINI_MODEL,
          contents:
            buildUserPrompt(seedKeyword, resolvedNiche, geography, nicheWasProvided) + emphasis,
          config: {
            systemInstruction: KEYWORD_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseJsonSchema: RESPONSE_JSON_SCHEMA,
          },
        })
    );

    const text = response.text?.trim();
    if (!text) {
      continue;
    }

    const parsed = JSON.parse(text) as {
      pillar?: unknown;
      clusters?: unknown;
    };

    const normalized = normalizeHubSpokeMap(parsed, {
      minClusters: 5,
      maxClusters: 15,
    });

    if (!normalized) {
      continue;
    }

    const baseResult = hubSpokeMapToKeywordSilo(normalized);
    // Tier 3: return structure immediately; Labs metrics enrich runs after persist.
    return baseResult;
  }

  throw new Error('Gemini did not return a valid keyword silo map. Please try again.');
}

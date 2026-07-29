import { GoogleGenAI, Type } from '@google/genai';
import {
  normalizeHubSpokeMap,
  type HubSpokeMap,
} from '@/lib/hub-spoke-data';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import type { PrunedCompetitorKeyword, SemanticGap } from '@/lib/competitor-intel/types';
import { normalizeHubGroups, type HubGroup } from '@/lib/silo-builder/hub-groups';

const GEMINI_MODEL = 'gemini-2.5-flash';

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
    semanticGaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          rationale: { type: Type.STRING },
          priority: { type: Type.STRING },
        },
        required: ['topic', 'rationale', 'priority'],
      },
    },
    hubGroups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hubTitle: { type: Type.STRING },
          hubKeyword: { type: Type.STRING },
          spokeTitles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['hubTitle', 'hubKeyword', 'spokeTitles'],
      },
    },
  },
  required: ['pillar', 'clusters', 'semanticGaps'],
};

export type CompetitorAttackMapGeneration = {
  map: HubSpokeMap;
  semanticGaps: SemanticGap[];
  hubGroups: HubGroup[];
};

function buildSystemPrompt(coreNiche: string): string {
  return `You are an elite SEO architect. The user wants to dominate the niche: '${coreNiche}'. I am providing the top 500 keywords their competitor ranks for. Group these into 3-5 core 'Hubs' and 5-10 'Spokes'. More importantly, analyze the competitor's data against the broader '${coreNiche}' topic to identify 'Semantic Gaps' (highly relevant sub-topics they are missing). Structure a superior, comprehensive content silo designed to outrank them. Return strict JSON matching our Hub/Spoke schema.

Requirements:
- Return exactly one pillar page representing the dominant attack hub for '${coreNiche}'.
- Return 5 to 10 cluster spokes that exploit competitor weaknesses and semantic gaps.
- Each cluster must include 1-2 lateralLinks to other cluster titles and 3-5 semanticEntities.
- targetKeyword must be a literal Google search query (2-5 words), not an editorial phrase. Prefer competitor keyword vocabulary when relevant.
- semanticGaps must list 3-8 high-value topics the competitor is missing, each with topic, rationale, and priority (high, medium, or low).
- hubGroups is optional metadata grouping 3-5 hub themes to their spoke titles.
- Return strict JSON only. No markdown fences, no commentary.`;
}

function buildUserPrompt(
  coreNiche: string,
  competitorDomain: string,
  targetCountry: string,
  keywords: PrunedCompetitorKeyword[]
): string {
  const keywordSample = keywords
    .slice(0, 500)
    .map(item => ({
      keyword: item.keyword,
      searchVolume: item.searchVolume,
      rank: item.rank,
    }));

  return [
    `Core Niche: ${coreNiche}`,
    `Competitor Domain: ${competitorDomain}`,
    `Target Country: ${targetCountry}`,
    `Competitor Keywords (${keywordSample.length} pruned records):`,
    JSON.stringify(keywordSample),
    '',
    'Architect a superior Hub & Spoke topical map that attacks their semantic gaps and outranks them.',
  ].join('\n');
}

function normalizeSemanticGaps(value: unknown): SemanticGap[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const candidate = item as SemanticGap;
      const topic = candidate.topic?.trim();
      const rationale = candidate.rationale?.trim();
      const priority = candidate.priority?.trim().toLowerCase();

      if (!topic || !rationale) {
        return null;
      }

      const normalizedPriority =
        priority === 'high' || priority === 'medium' || priority === 'low'
          ? priority
          : 'medium';

      return {
        topic,
        rationale,
        priority: normalizedPriority,
      };
    })
    .filter((item): item is SemanticGap => item !== null);
}

export async function generateCompetitorAttackMap(
  ai: GoogleGenAI,
  params: {
    coreNiche: string;
    competitorDomain: string;
    targetCountry: string;
    keywords: PrunedCompetitorKeyword[];
    workspaceId: string;
  }
): Promise<CompetitorAttackMapGeneration | null> {
  const systemPrompt = buildSystemPrompt(params.coreNiche);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const emphasis =
      attempt > 1
        ? '\n\nCRITICAL: Return 5-10 clusters with lateralLinks and semanticEntities. Include at least 3 semanticGaps.'
        : '';

    const response = await withIntegrationTelemetry(
      {
        integrationType: 'GEMINI',
        targetUrl: GEMINI_MODEL,
        workspaceId: params.workspaceId,
        operation: `competitor_reverse_engineer_attempt_${attempt}`,
      },
      () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents:
            buildUserPrompt(
              params.coreNiche,
              params.competitorDomain,
              params.targetCountry,
              params.keywords
            ) + emphasis,
          config: {
            systemInstruction: systemPrompt,
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
      semanticGaps?: unknown;
      hubGroups?: unknown;
    };

    const normalized = normalizeHubSpokeMap(parsed, { minClusters: 5, maxClusters: 10 });
    if (!normalized) {
      continue;
    }

    const semanticGaps = normalizeSemanticGaps(parsed.semanticGaps);
    if (semanticGaps.length < 1) {
      continue;
    }

    const hubGroups = normalizeHubGroups(
      parsed.hubGroups,
      normalized.clusters.map(cluster => cluster.title)
    );

    return {
      map: normalized,
      semanticGaps,
      hubGroups,
    };
  }

  return null;
}

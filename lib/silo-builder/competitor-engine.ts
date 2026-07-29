import { GoogleGenAI } from '@google/genai';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { generateCompetitorAttackMap as generateHubSpokeAttackMap } from '@/lib/competitor-intel/generate-attack-map';
import {
  fetchSiloCompetitorRankedKeywords,
  type RankedKeywordRow,
} from '@/lib/silo-builder/dataforseo-ranked';
import { sliceRankedKeywordsForPersist } from '@/lib/silo-builder/ranked-keywords';
import { hubSpokeClusterToSpoke } from '@/lib/silo-builder/hub-spoke-convert';
import type { SiloAttackMapResult, SiloNodeGraphItem } from '@/lib/silo-builder/types';
import type { HubSpokeCluster } from '@/lib/hub-spoke-data';

function clusterToSpoke(cluster: HubSpokeCluster): SiloNodeGraphItem {
  return hubSpokeClusterToSpoke(cluster);
}

export async function generateCompetitorAttackMap(
  workspaceId: string,
  domain: string,
  geography: string,
  niche: string,
  preloadedKeywords?: RankedKeywordRow[]
): Promise<SiloAttackMapResult> {
  const rankedKeywords =
    preloadedKeywords ??
    (await fetchSiloCompetitorRankedKeywords(domain, geography, workspaceId));

  const cred = await resolveLlmCredential(workspaceId, 'gemini');
  if (!cred) {
    throw new Error('Gemini API credentials are not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: cred.apiKey });
  const generated = await generateHubSpokeAttackMap(ai, {
    coreNiche: niche,
    competitorDomain: domain,
    targetCountry: geography,
    keywords: rankedKeywords,
    workspaceId,
  });

  if (!generated) {
    throw new Error('Gemini did not return a valid attack map. Please try again.');
  }

  const { map } = generated;

  // Tier 3: persist structure first; progressive Labs enrich runs after save.
  return {
    semanticGaps: generated.semanticGaps,
    keywordsAnalyzed: rankedKeywords.length,
    rankedKeywords: sliceRankedKeywordsForPersist(rankedKeywords),
    hubGroups: generated.hubGroups,
    pillar: {
      title: map.pillar.title,
      type: 'PILLAR',
      targetKeyword: map.pillar.targetKeyword,
      intent: 'Informational',
      summary: map.pillar.summary,
      searchVolume: null,
      difficulty: null,
    },
    spokes: map.clusters.map(clusterToSpoke),
  };
}

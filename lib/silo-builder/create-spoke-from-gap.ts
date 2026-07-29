import { GoogleGenAI, Type } from '@google/genai';
import { getPrisma } from '@/lib/prisma';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { enrichKeywordWithMetrics } from '@/lib/silo-builder/enrich-node-metrics';
import { syncSiloProjectMetricsStatus } from '@/lib/silo-builder/enrich-metrics';
import { parseRankedKeywords } from '@/lib/silo-builder/ranked-keywords';
import { SILO_GEMINI_MODEL } from '@/lib/silo-builder/constants';
import { toNodeDto } from '@/lib/silo-builder/persist';
import type { SemanticGap } from '@/lib/silo-builder/semantic-gaps';
import type { SiloNodeDto } from '@/lib/silo-builder/types';

type CreateSpokeFromGapInput = {
  projectId: string;
  workspaceId: string;
  gap: SemanticGap;
};

type SpokeMetadata = {
  title: string;
  targetKeyword: string;
  funnelStage: string;
  intent: string;
  summary: string;
  anchorTextToPillar: string;
};

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    targetKeyword: { type: Type.STRING },
    funnelStage: { type: Type.STRING },
    intent: { type: Type.STRING },
    summary: { type: Type.STRING },
    anchorTextToPillar: { type: Type.STRING },
  },
  required: [
    'title',
    'targetKeyword',
    'funnelStage',
    'intent',
    'summary',
    'anchorTextToPillar',
  ],
};

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function buildFallbackMetadata(
  gap: SemanticGap,
  pillarTitle: string,
  pillarKeyword: string | null
): SpokeMetadata {
  return {
    title: gap.topic.trim(),
    targetKeyword: gap.topic.trim(),
    funnelStage: gap.priority === 'high' ? 'MOFU' : 'TOFU',
    intent: 'Informational',
    summary: gap.rationale.trim(),
    anchorTextToPillar: pillarKeyword?.trim() || pillarTitle.trim(),
  };
}

async function resolveSpokeMetadataFromGap(
  workspaceId: string,
  gap: SemanticGap,
  context: {
    pillarTitle: string;
    pillarKeyword: string | null;
    niche: string | null;
    geography: string | null;
    domain: string | null;
  }
): Promise<SpokeMetadata> {
  const fallback = buildFallbackMetadata(gap, context.pillarTitle, context.pillarKeyword);
  const cred = await resolveLlmCredential(workspaceId, 'gemini');

  if (!cred) {
    return fallback;
  }

  const ai = new GoogleGenAI({ apiKey: cred.apiKey });
  const prompt = [
    'Generate SEO spoke page metadata for a semantic gap in a competitor attack silo.',
    `Gap topic: ${gap.topic}`,
    `Gap rationale: ${gap.rationale}`,
    `Gap priority: ${gap.priority}`,
    `Pillar title: ${context.pillarTitle}`,
    context.pillarKeyword ? `Pillar keyword: ${context.pillarKeyword}` : '',
    context.niche ? `Niche: ${context.niche}` : '',
    context.geography ? `Geography: ${context.geography}` : '',
    context.domain ? `Competitor domain: ${context.domain}` : '',
    '',
    'Return strict JSON only. funnelStage must be TOFU, MOFU, or BOFU.',
    'targetKeyword should be a realistic search phrase for this geography.',
    'summary should be 1-2 sentences expanding the gap rationale for writers.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await withIntegrationTelemetry(
      {
        integrationType: 'GEMINI',
        targetUrl: SILO_GEMINI_MODEL,
        workspaceId,
        operation: 'silo_gap_spoke_metadata',
      },
      () =>
        ai.models.generateContent({
          model: SILO_GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_JSON_SCHEMA,
          },
        })
    );

    const text = response.text?.trim();
    if (!text) {
      return fallback;
    }

    const parsed = JSON.parse(text) as Partial<SpokeMetadata>;
    const funnelStage = ['TOFU', 'MOFU', 'BOFU'].includes(
      String(parsed.funnelStage ?? '').toUpperCase()
    )
      ? String(parsed.funnelStage).toUpperCase()
      : fallback.funnelStage;

    return {
      title: parsed.title?.trim() || fallback.title,
      targetKeyword: parsed.targetKeyword?.trim() || fallback.targetKeyword,
      funnelStage,
      intent: parsed.intent?.trim() || fallback.intent,
      summary: parsed.summary?.trim() || fallback.summary,
      anchorTextToPillar:
        parsed.anchorTextToPillar?.trim() || fallback.anchorTextToPillar,
    };
  } catch {
    return fallback;
  }
}

export async function createSpokeFromGap(
  input: CreateSpokeFromGapInput
): Promise<SiloNodeDto> {
  const prisma = getPrisma();
  const gapTopic = input.gap.topic.trim();
  const gapRationale = input.gap.rationale.trim();

  if (!gapTopic || !gapRationale) {
    throw new Error('Gap topic and rationale are required.');
  }

  const project = await prisma.siloProject.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId },
    include: {
      nodes: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found or access denied');
  }

  const pillar = project.nodes.find(node => node.type === 'PILLAR');
  if (!pillar) {
    throw new Error('This silo project has no pillar node.');
  }

  const normalizedGapTopic = normalizeTitle(gapTopic);
  const duplicate = project.nodes.some(
    node =>
      node.type === 'SPOKE' &&
      (normalizeTitle(node.title) === normalizedGapTopic ||
        normalizeTitle(node.targetKeyword ?? '') === normalizedGapTopic)
  );

  if (duplicate) {
    throw new Error('A spoke for this gap already exists in the silo.');
  }

  const metadata = await resolveSpokeMetadataFromGap(input.workspaceId, input.gap, {
    pillarTitle: pillar.title,
    pillarKeyword: pillar.targetKeyword,
    niche: project.niche,
    geography: project.geography,
    domain: project.domain,
  });

  const location = project.geography?.trim() || 'Malaysia';
  const rankedKeywords = parseRankedKeywords(project.rankedKeywords);
  const meta = await enrichKeywordWithMetrics({
    rawKeyword: metadata.targetKeyword,
    location,
    workspaceId: input.workspaceId,
    competitorKeywords: rankedKeywords,
  });

  const enrichedAt = new Date();
  const spoke = await prisma.siloNode.create({
    data: {
      projectId: project.id,
      title: metadata.title,
      type: 'SPOKE',
      targetKeyword: meta.targetKeyword,
      originalTargetKeyword: meta.originalTargetKeyword,
      keywordSource: meta.keywordSource,
      metricsConfidence: meta.metricsConfidence,
      searchVolume: meta.searchVolume,
      difficulty: meta.difficulty,
      enrichedAt,
      intent: metadata.intent,
      summary: metadata.summary,
      funnelStage: metadata.funnelStage,
      anchorTextToPillar: metadata.anchorTextToPillar,
      parentId: pillar.id,
      status: 'DRAFT',
    },
  });

  const allNodes = await prisma.siloNode.findMany({
    where: { projectId: project.id },
  });
  await syncSiloProjectMetricsStatus(
    project.id,
    allNodes.map(toNodeDto),
    { enrichedAt }
  );

  return toNodeDto(spoke);
}

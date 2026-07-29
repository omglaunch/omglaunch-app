import { GoogleGenAI, Type } from '@google/genai';
import type {
  ComparePageMetrics,
  CompetitiveStrategyPlan,
  CompetitorCompareResult,
  SemanticMarketGapRow,
} from '@/lib/competitor-compare-data';

const BODY_EXCERPT_CHARS = 7000;

type GeminiGapCandidate = {
  entity: string;
  entityType: string;
  featuredOnCompetitorIndices: number[];
  briefContext: string;
};

type GeminiGapResponse = {
  gaps: GeminiGapCandidate[];
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}…`;
}

function buildStructuredPageBlock(page: ComparePageMetrics, role: string): string {
  const headingBlock =
    page.headings.length > 0
      ? page.headings.map(heading => `  - ${heading}`).join('\n')
      : '  (none detected)';

  return [
    `=== ${role} ===`,
    `URL: ${page.url}`,
    `Title: ${page.title || '(none)'}`,
    `Word count: ${page.wordCount}`,
    `Headings:`,
    headingBlock,
    `Body content:`,
    truncateText(page.bodyText, BODY_EXCERPT_CHARS),
  ].join('\n');
}

function buildGapAnalysisPrompt(
  yourPage: ComparePageMetrics,
  competitors: ComparePageMetrics[],
  targetKeyword: string
): string {
  const competitorBlocks = competitors
    .map((page, index) => buildStructuredPageBlock(page, `COMPETITOR ${index + 1}`))
    .join('\n\n');

  return [
    `Target keyword / search intent: ${targetKeyword || '(not specified)'}`,
    '',
    buildStructuredPageBlock(yourPage, 'YOUR PAGE (the site to improve)'),
    '',
    competitorBlocks,
    '',
    'Analyze the structured content above. Identify genuine content gaps for the user page.',
  ].join('\n');
}

const GAP_EXTRACTION_SYSTEM_PROMPT = `You are an enterprise-grade SEO and Generative Engine Optimization (GEO) strategist.

Your task is topic modeling across competing pages — NOT keyword token extraction.

Rules:
- Identify up to 10 high-value gaps: specific product categories, commercial concepts, buyer-intent angles, or named entity themes (e.g. "Ultralight Sleeping Bags", "Trekking Poles", "Waterproof Shells", "Buying Guide for Beginners").
- Each gap MUST be a meaningful, actionable topic a content strategist would assign to a writer — never generic word pairs or sentence fragments (reject outputs like "website hiking", "every hiking", "leading hiking", or "gas hiking").
- Only include topics that are clearly and substantially featured across competitor pages (dedicated sections, repeated product mentions, or strong commercial intent) but are completely absent from the user's page.
- "Absent" means the user's page does not meaningfully cover that topic — treat it as a zero-coverage gap.
- featuredOnCompetitorIndices uses 0-based indices matching COMPETITOR 1, COMPETITOR 2, etc. Include an index only if that competitor meaningfully covers the topic.
- Prefer gaps featured on multiple competitors; include high-impact single-competitor gaps only if they are clearly strategic (major product line or intent angle).
- entityType must be one of: "product category", "commercial concept", "intent angle", "entity theme".
- Order gaps by strategic impact (highest first). Return fewer than 10 if fewer genuine gaps exist — never pad with low-quality items.`;

function mapGeminiGapsToRows(
  gaps: GeminiGapCandidate[] | undefined,
  totalCompetitors: number
): SemanticMarketGapRow[] {
  const rows: SemanticMarketGapRow[] = [];

  for (const candidate of gaps ?? []) {
    const entity = candidate.entity?.trim();
    if (!entity || (entity.split(' ').length < 2 && entity.length < 8)) continue;

    const validIndices = (candidate.featuredOnCompetitorIndices ?? []).filter(
      index => index >= 0 && index < totalCompetitors
    );
    const uniqueIndices = Array.from(new Set(validIndices));
    if (uniqueIndices.length === 0) continue;

    const indexSet = new Set(uniqueIndices);
    const competitorCovers = Array.from({ length: totalCompetitors }, (_, index) =>
      indexSet.has(index)
    );
    const competitorCoverageCount = uniqueIndices.length;
    const competitorCoveragePercent = Math.round(
      (competitorCoverageCount / totalCompetitors) * 100
    );

    rows.push({
      entity,
      entityType: candidate.entityType || 'commercial concept',
      competitorCovers,
      competitorCoverageCount,
      competitorCoverageTotal: totalCompetitors,
      competitorCoveragePercent,
    });
  }

  return rows
    .sort((a, b) => b.competitorCoverageCount - a.competitorCoverageCount)
    .slice(0, 10);
}

export async function extractSemanticMarketGapsWithGemini(
  yourPage: ComparePageMetrics,
  competitors: ComparePageMetrics[],
  targetKeyword: string
): Promise<SemanticMarketGapRow[]> {
  const ai = getGeminiClient();
  const prompt = buildGapAnalysisPrompt(yourPage, competitors, targetKeyword);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: GAP_EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          gaps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                entity: {
                  type: Type.STRING,
                  description:
                    'Specific product category, commercial concept, or intent theme missing from the user page',
                },
                entityType: {
                  type: Type.STRING,
                  description:
                    'One of: product category, commercial concept, intent angle, entity theme',
                },
                featuredOnCompetitorIndices: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                  description: '0-based competitor indices where this topic is meaningfully covered',
                },
                briefContext: {
                  type: Type.STRING,
                  description: 'One sentence on why competitors emphasize this and why it matters',
                },
              },
              required: ['entity', 'entityType', 'featuredOnCompetitorIndices', 'briefContext'],
            },
          },
        },
        required: ['gaps'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned an empty gap analysis response');
  }

  const parsed = JSON.parse(text) as GeminiGapResponse;
  return mapGeminiGapsToRows(parsed.gaps, competitors.length);
}

function buildStrategyContext(result: Omit<CompetitorCompareResult, 'strategyPlan'>): string {
  const topGaps = (result.semanticGaps ?? []).slice(0, 5);
  const gapSummary =
    topGaps.length > 0
      ? topGaps
          .map(
            (gap, index) =>
              `${index + 1}. ${gap.entity} (${gap.entityType}) — ${gap.competitorCoverageCount}/${gap.competitorCoverageTotal} competitors cover this`
          )
          .join('\n')
      : '(no major semantic gaps detected)';

  const competitorSummary = (result.competitors ?? [])
    .map(
      (comp, index) =>
        `Comp ${index + 1}: GEO ${comp.geoScore ?? 'N/A'}, ${comp.wordCount} words, ${comp.headingCount} headings — ${comp.url}`
    )
    .join('\n');

  return [
    `Target keyword: ${result.targetKeyword || '(not specified)'}`,
    `Your page: ${result.yourPage?.url ?? '(unknown)'}`,
    `Your GEO score: ${result.yourPage?.geoScore ?? 'N/A'}`,
    `Your word count: ${result.yourPage?.wordCount ?? 'N/A'}`,
    `Your heading count: ${result.yourPage?.headingCount ?? 'N/A'}`,
    '',
    'Competitor snapshot:',
    competitorSummary,
    '',
    'Top semantic market gaps (missing from your page — synthesize across ALL of these, not just #1):',
    gapSummary,
  ].join('\n');
}

const STRATEGY_PLAN_SYSTEM_PROMPT = `You are an enterprise GEO strategist writing for a non-technical marketing user.

Based on the competitive audit data provided, produce a highly actionable 3-part strategy plan.

CRITICAL SYNTHESIS RULES:
- Do NOT focus only on the first gap or a single entity. Review the top 3–5 macro-gaps together and identify the broader pattern (e.g. missing product categories, missing buyer-intent angles, missing gear verticals).
- Synthesize gaps into a unified structural roadmap. Example: if Footwear, Backpacks, and Hydration are all missing, advise creating a holistic "Essential Hiking Gear Checklist" subsection — NOT three separate one-off paragraphs about boots alone.
- Name multiple gap themes in criticalGapFocus when they form a cluster (e.g. "core gear verticals: footwear, packs, and hydration").
- structuralRecommendation and nextBestAction must address the combined gap pattern with one coherent content architecture.

Write in clear, direct prose — no jargon without explanation. Reference specific numbers from the audit (word counts, GEO scores, gap names) when helpful.

Each field should be 2-4 sentences and immediately actionable:
- criticalGapFocus: Explain the macro-pattern across the top 3–5 gaps — what major product categories, intent angles, or commercial themes the user ignored as a group, and why that cluster hurts GEO visibility.
- structuralRecommendation: Compare their page structure vs competitors and propose one unified section or hub (checklist, buying guide, category roundup) that closes multiple gaps at once, tied to their word count and competitor patterns.
- nextBestAction: A concrete outline or writing prompt for that unified section — include suggested H2/H3 headings that cover the combined gap themes, not just the top single item.`;

export async function generateCompetitiveStrategyPlan(
  result: Omit<CompetitorCompareResult, 'strategyPlan'>
): Promise<CompetitiveStrategyPlan> {
  const ai = getGeminiClient();
  const context = buildStrategyContext(result);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate the AI Competitive Strategy Plan for this audit:\n\n${context}`,
    config: {
      systemInstruction: STRATEGY_PLAN_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          criticalGapFocus: {
            type: Type.STRING,
            description:
              'Macro-pattern across the top 3-5 gaps — clustered themes ignored, not just one item',
          },
          structuralRecommendation: {
            type: Type.STRING,
            description:
              'Unified structural content recommendation that closes multiple gaps together',
          },
          nextBestAction: {
            type: Type.STRING,
            description:
              'Concrete outline for a unified section covering combined gap themes with H2/H3 headings',
          },
        },
        required: ['criticalGapFocus', 'structuralRecommendation', 'nextBestAction'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned an empty strategy plan response');
  }

  return JSON.parse(text) as CompetitiveStrategyPlan;
}

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type {
  ComparePageMetrics,
  CompetitiveStrategyPlan,
  SemanticMarketGapRow,
} from '@/lib/competitor-compare-data';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a Master SEO Content Strategist. Your objective is to create an elite, highly structured Content Brief for a writer or AI agent, based on a competitive gap analysis. 
You will be provided with:
1. Target Keyword
2. Target URL
3. The AI Strategy Plan (a competitor gap analysis)

INSTRUCTIONS:
- Output strictly in Markdown format. 
- Do not include conversational filler like 'Here is your brief'.
- Use clear headings (#, ##, ###), bold text, and bullet points for maximum scannability.
- Base all recommendations on closing the specific gaps identified in the provided AI Strategy Plan.

STRUCTURE YOUR OUTPUT EXACTLY LIKE THIS:
# SEO Content Brief: [Insert Target Keyword]
## 1. Strategy Overview
* **Target Search Intent:** [Informational, Commercial, or Transactional - based on the keyword]
* **Target Audience Persona:** [Brief description of the ideal reader]
* **Target Word Count:** [Estimate based on the strategy plan's suggestions]
## 2. Meta Data
* **SEO Title:** [Provide a highly clickable title, under 60 characters]
* **Meta Description:** [Provide an engaging description under 160 characters, including the target keyword]
## 3. E-E-A-T & Trust Requirements
* [Bullet point specific ways the writer can prove Experience, Expertise, Authoritativeness, and Trustworthiness]
## 4. Semantic SEO & Entities
* **Primary Keyword:** [Target Keyword]
* **Secondary Keywords & LSI Terms:** [List 5-8 related terms the writer MUST include naturally]
* **NLP Entities:** [List 3-5 core concepts or proper nouns related to the topic]
## 5. Comprehensive Content Outline
[Build a detailed H2/H3 structure based DIRECTLY on the AI Strategy Plan. Under each heading, provide 2-3 specific bullet points on what the writer must cover to satisfy user intent and close the competitor gaps.]
## 6. Internal & External Linking Strategy
* **Internal Links:** [Suggest 2-3 topical themes the writer should link to within the site]
* **External Links:** [Suggest 1-2 types of authoritative external sources to cite]
## 7. Media & Visual Requirements
* [Suggest where to place images, infographics, or comparison tables]
* [Provide 2-3 suggested Image Alt Text themes]`;

const EMPTY_GAPS_STRATEGY_INSTRUCTION = `IF the provided semantic gaps array is empty, it means the user's page already covers the basic topical elements. Instead of searching for missing topics, your mission for this Content Brief is to build an EXPANSION AND DOMINANCE STRATEGY.
- Focus on technical signals: analyze the technical comparison table (such as competing with higher word counts or heading counts).
- Focus on multimedia and engagement: map out richer image/alt-text themes and deeply contextual sections to dramatically out-rank the competitors on E-E-A-T and semantic depth.`;

type GenerateBriefRequest = {
  targetKeyword: string;
  targetUrl: string;
  aiStrategyPlan?: CompetitiveStrategyPlan | null;
  semanticGaps?: SemanticMarketGapRow[];
  yourPage?: ComparePageMetrics;
  competitors?: ComparePageMetrics[];
};

function isGenerateBriefRequest(body: unknown): body is GenerateBriefRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as GenerateBriefRequest;

  return (
    typeof candidate.targetKeyword === 'string' &&
    typeof candidate.targetUrl === 'string'
  );
}

function formatPageMetrics(label: string, page: ComparePageMetrics): string {
  const imagesWithAlt = page.images.total - page.images.missingAlt;
  return [
    `${label}: ${page.url}`,
    `  Word count: ${page.wordCount}`,
    `  Heading count: ${page.headingCount}`,
    `  GEO score: ${page.geoScore ?? 'N/A'}`,
    `  Images: ${page.images.total} total (${imagesWithAlt} with alt text)`,
    `  Trust signals: ${page.trustSignals.outboundLinks} outbound links, ${page.trustSignals.statistics} stats, ${page.trustSignals.quotes} quotes`,
  ].join('\n');
}

function buildUserPrompt(request: GenerateBriefRequest): string {
  const {
    targetKeyword,
    targetUrl,
    aiStrategyPlan,
    semanticGaps = [],
    yourPage,
    competitors = [],
  } = request;

  const sections = [
    `Target Keyword: ${targetKeyword}`,
    `Target URL: ${targetUrl}`,
    '',
    `Semantic Market Gaps (${semanticGaps.length} detected):`,
    semanticGaps.length > 0
      ? semanticGaps
          .map(
            (gap, index) =>
              `${index + 1}. ${gap.entity} (${gap.entityType}) — ${gap.competitorCoverageCount}/${gap.competitorCoverageTotal} competitors cover this`
          )
          .join('\n')
      : '(none — page already covers core topical elements)',
  ];

  if (yourPage) {
    sections.push('', 'Your Page (Technical Comparison):', formatPageMetrics('Your App', yourPage));
  }

  if (competitors.length > 0) {
    sections.push(
      '',
      'Competitors (Technical Comparison):',
      competitors
        .map((competitor, index) => formatPageMetrics(`Comp ${index + 1}`, competitor))
        .join('\n\n')
    );
  }

  if (aiStrategyPlan) {
    sections.push(
      '',
      'AI Strategy Plan:',
      `- Critical Gap Focus: ${aiStrategyPlan.criticalGapFocus}`,
      `- Structural Recommendation: ${aiStrategyPlan.structuralRecommendation}`,
      `- Next Best Action: ${aiStrategyPlan.nextBestAction}`
    );
  }

  if (semanticGaps.length === 0) {
    sections.push('', 'STRATEGY MODE:', EMPTY_GAPS_STRATEGY_INSTRUCTION);
  }

  return sections.join('\n');
}

function buildSystemPrompt(semanticGaps: SemanticMarketGapRow[]): string {
  if (semanticGaps.length === 0) {
    return `${SYSTEM_PROMPT}\n\n${EMPTY_GAPS_STRATEGY_INSTRUCTION}`;
  }

  return SYSTEM_PROMPT;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isGenerateBriefRequest(body)) {
    return NextResponse.json(
      { error: 'targetKeyword and targetUrl are required' },
      { status: 400 }
    );
  }

  const { targetKeyword, targetUrl } = body;
  const semanticGaps = body.semanticGaps ?? [];

  if (!targetKeyword.trim()) {
    return NextResponse.json({ error: 'targetKeyword is required' }, { status: 400 });
  }

  if (!targetUrl.trim()) {
    return NextResponse.json({ error: 'targetUrl is required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildUserPrompt(body),
      config: {
        systemInstruction: buildSystemPrompt(semanticGaps),
      },
    });

    const markdown = response.text?.trim();
    if (!markdown) {
      return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 500 });
    }

    const brief = await prisma.contentBrief.create({
      data: {
        targetKeyword: targetKeyword.trim(),
        targetUrl: targetUrl.trim(),
        content: markdown,
      },
    });

    return NextResponse.json({ markdown, brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Content brief generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

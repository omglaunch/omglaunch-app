import type { CompetitorCompareResult, SemanticMarketGapRow } from '@/lib/competitor-compare-data';

export function buildCompetitorCompareBriefTitle(keyword: string): string {
  const trimmed = keyword.trim();
  return trimmed ? `SEO Content Brief: ${trimmed}` : 'SEO Content Brief: Market Gap Analysis';
}

function buildSuggestedSeoTitle(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return 'Expert Guide to Closing Competitive Content Gaps';
  }

  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${capitalized}: Expert Guide to Solutions & Prevention`;
}

function buildSuggestedMetaDescription(
  keyword: string,
  missingGaps: SemanticMarketGapRow[]
): string {
  const trimmed = keyword.trim();
  const topEntities = missingGaps
    .slice(0, 3)
    .map(gap => gap.entity)
    .filter(Boolean);

  if (!trimmed) {
    return 'GEO-optimized meta description pending — will be generated from competitive gap analysis and article content.';
  }

  if (topEntities.length > 0) {
    return `Draft meta for "${trimmed}" covering ${topEntities.join(', ')} — finalize with GEO keyword placement, entity clarity, and a 145–160 character SERP hook.`;
  }

  return `Draft meta for "${trimmed}" — finalize with primary keyword in the first 120 characters, concrete entities, and a direct value proposition for SERP/AI citation.`;
}

export function formatCompetitorCompareBrief(result: CompetitorCompareResult): string {
  const keyword = result.targetKeyword.trim() || 'Target keyword';
  const missingGaps = (result.semanticGaps ?? []).filter(
    gap => gap.competitorCoverageCount > 0
  );
  const plan = result.strategyPlan;
  const suggestedSeoTitle = buildSuggestedSeoTitle(keyword);
  const suggestedMetaDescription = buildSuggestedMetaDescription(keyword, missingGaps);

  const lines = [
    `# ${buildCompetitorCompareBriefTitle(keyword)}`,
    '',
    '## Strategy Overview',
    `* **Primary Keyword:** ${keyword}`,
    `* **Target URL:** ${result.yourPage?.url ?? '—'}`,
    `* **Source:** Page Optimizer`,
    '',
    '## 2. Meta Data',
    `* **SEO Title:** ${suggestedSeoTitle}`,
    `* **Meta Description:** ${suggestedMetaDescription}`,
    '',
    '## Semantic Market Gaps to Close',
  ];

  if (missingGaps.length === 0) {
    lines.push(
      '* No critical semantic gaps detected — focus on depth, E-E-A-T, and technical signals from the competitive strategy plan below.'
    );
  } else {
    missingGaps.forEach((gap, index) => {
      lines.push(
        `${index + 1}. **${gap.entity}** (${gap.entityType}) — covered by ${gap.competitorCoverageCount}/${gap.competitorCoverageTotal} competitors`
      );
    });
  }

  if (plan) {
    lines.push(
      '',
      '## AI Competitive Strategy Plan',
      '',
      '### Critical Gap Focus',
      plan.criticalGapFocus,
      '',
      '### Structural Recommendation',
      plan.structuralRecommendation,
      '',
      '### Next Best Action',
      plan.nextBestAction
    );
  }

  lines.push(
    '',
    '## Content Direction',
    'Draft comprehensive content that closes the semantic gaps above, matches or exceeds competitor word depth, and implements the structural recommendations from the AI strategy plan.',
    '',
    '## Technical GEO Signals to Address',
    `* **Word Count Target:** Match or exceed top competitors (your page: ${result.yourPage?.wordCount?.toLocaleString() ?? '—'} words)`,
    `* **Structured Data:** Add FAQ, Article, or Product schema where relevant for LLM parsing`,
    `* **Readability:** Target an accessible Flesch-Kincaid grade level for your audience`,
    `* **Trust Signals:** Increase outbound citations, statistics, and expert quotes`
  );

  return lines.join('\n').trimEnd();
}

export function getMissingSemanticGaps(gaps: SemanticMarketGapRow[]): SemanticMarketGapRow[] {
  return gaps.filter(gap => gap.competitorCoverageCount > 0);
}

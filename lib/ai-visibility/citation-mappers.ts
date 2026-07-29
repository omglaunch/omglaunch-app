/**
 * Map raw engine answers + URLs → vault citation shapes.
 */

import {
  textMentionsBrand,
  urlMatchesBrandAliases,
} from '@/lib/ai-visibility/brand-match';
import {
  hashSnippet,
  sanitizeLlmMarkdown,
} from '@/lib/ai-visibility/sanitize';
import {
  analyzeEntitySentiment,
  type AbsaSentiment,
} from '@/lib/ai-visibility/sentiment';
import type {
  CompetitorThreat,
  CompetitorWinner,
  LlmCitation,
  PerplexityCitation,
  SyncDotStatus,
  TrackedEngine,
} from '@/lib/ai-visibility/types';

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s\]\)"'<>]+/gi) ?? [];
  const cleaned = matches.map((u) => u.replace(/[.,;:]+$/g, ''));
  return Array.from(new Set(cleaned));
}

function primaryBrandLabel(brandAliases: string[]): string {
  const plain = brandAliases.find(
    (a) => a && !a.includes('*') && !a.startsWith('/') && !a.includes('.')
  );
  return plain ?? brandAliases[0] ?? 'brand';
}

export async function mapLlmCitation(
  answer: string,
  urls: string[],
  brandAliases: string[]
): Promise<LlmCitation> {
  const snippet = await sanitizeLlmMarkdown(answer.slice(0, 1200));
  const snippetHash = await hashSnippet(answer);
  const entity = primaryBrandLabel(brandAliases);
  const sentiment: AbsaSentiment = analyzeEntitySentiment(answer, entity);

  const brandUrl = urls.find((u) => urlMatchesBrandAliases(u, brandAliases));
  const mentioned = textMentionsBrand(answer, brandAliases);

  if (brandUrl) {
    return {
      kind: 'inline_link',
      snippet,
      sentiment,
      snippetHash,
    };
  }

  if (mentioned) {
    if (sentiment === 'negative') {
      return {
        kind: 'negative_context',
        snippet,
        sentiment,
        snippetHash,
      };
    }
    return {
      kind: 'text_mention',
      snippet,
      sentiment,
      snippetHash,
    };
  }

  return { kind: 'omitted', snippet, sentiment, snippetHash };
}

export function mapPerplexityCitation(
  answer: string,
  urls: string[],
  brandAliases: string[]
): PerplexityCitation {
  const brandIdx = urls.findIndex((u) =>
    urlMatchesBrandAliases(u, brandAliases)
  );
  if (brandIdx >= 0) {
    return { kind: 'cited', rank: brandIdx + 1 };
  }
  if (textMentionsBrand(answer, brandAliases)) {
    // Mention without a citation URL — treat as cited at end of list.
    return { kind: 'cited', rank: Math.max(1, urls.length + 1) };
  }
  return { kind: 'omitted' };
}

function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 48);
  }
}

export function buildLiveCompetitorThreat(input: {
  perplexity: PerplexityCitation;
  chatgpt: LlmCitation;
  claude: LlmCitation;
  perplexityUrls: string[];
  chatgptUrls: string[];
  claudeUrls: string[];
  brandAliases: string[];
}): CompetitorThreat {
  const brandCited =
    (input.perplexity.kind === 'cited') &&
    (input.chatgpt.kind === 'inline_link' ||
      input.chatgpt.kind === 'text_mention') &&
    (input.claude.kind === 'inline_link' ||
      input.claude.kind === 'text_mention');

  if (brandCited) return { kind: 'dominating' };

  const winners: CompetitorWinner[] = [];

  const pushWinner = (
    engine: TrackedEngine,
    urls: string[],
    citationCited: boolean
  ) => {
    if (citationCited) return;
    const competitorUrl = urls.find(
      (u) => !urlMatchesBrandAliases(u, input.brandAliases)
    );
    if (!competitorUrl) return;
    winners.push({
      engine,
      name: hostnameLabel(competitorUrl),
      url: competitorUrl,
      sentiment: 'neutral',
    });
  };

  pushWinner(
    'perplexity',
    input.perplexityUrls,
    input.perplexity.kind === 'cited'
  );
  pushWinner(
    'chatgpt',
    input.chatgptUrls,
    input.chatgpt.kind === 'inline_link' ||
      input.chatgpt.kind === 'text_mention'
  );
  pushWinner(
    'claude',
    input.claudeUrls,
    input.claude.kind === 'inline_link' || input.claude.kind === 'text_mention'
  );

  if (winners.length === 0) {
    return { kind: 'dominating' };
  }

  return {
    kind: 'threat',
    winners: winners.slice(0, 3),
    dominantSentiment: 'neutral',
  };
}

/** Overall persistence dot from this sync's live engines. */
export function persistenceFromLiveSync(input: {
  perplexity: PerplexityCitation;
  chatgpt: LlmCitation;
  claude: LlmCitation;
}): SyncDotStatus {
  const failed =
    input.perplexity.kind === 'sync_failed' &&
    input.chatgpt.kind === 'sync_failed' &&
    input.claude.kind === 'sync_failed';
  if (failed) return 'failed';

  const cited =
    input.perplexity.kind === 'cited' ||
    input.chatgpt.kind === 'inline_link' ||
    input.chatgpt.kind === 'text_mention' ||
    input.claude.kind === 'inline_link' ||
    input.claude.kind === 'text_mention';
  if (cited) return 'cited';

  const anyFailed =
    input.perplexity.kind === 'sync_failed' ||
    input.chatgpt.kind === 'sync_failed' ||
    input.claude.kind === 'sync_failed';
  if (anyFailed) return 'failed';

  return 'omitted';
}

export function pushPersistenceTrend(
  trend: SyncDotStatus[],
  next: SyncDotStatus
): SyncDotStatus[] {
  const base = trend.length >= 7 ? trend.slice(-6) : [...trend];
  return [...base, next];
}

import type {
  CompetitorThreat,
  GoogleAioCitation,
  LlmCitation,
  PerplexityCitation,
  TrackedEngine,
  VisibilityRow,
} from '@/lib/ai-visibility/types';

export function isOmittedEverywhere(row: VisibilityRow): boolean {
  const engines = [row.googleAio, row.perplexity, row.chatgpt, row.claude];
  return engines.every((c) => c.kind === 'omitted' || c.kind === 'na_rag');
}

export function hasNegativeContext(row: VisibilityRow): boolean {
  return (
    row.chatgpt.kind === 'negative_context' ||
    row.claude.kind === 'negative_context'
  );
}

export function hasSyncFailed(row: VisibilityRow): boolean {
  return (
    row.googleAio.kind === 'sync_failed' ||
    row.perplexity.kind === 'sync_failed' ||
    row.chatgpt.kind === 'sync_failed' ||
    row.claude.kind === 'sync_failed' ||
    row.rowSyncState === 'failed'
  );
}

export function failedEngines(row: VisibilityRow): TrackedEngine[] {
  const out: TrackedEngine[] = [];
  if (row.googleAio.kind === 'omitted' || row.googleAio.kind === 'sync_failed') {
    out.push('google_aio');
  }
  if (row.perplexity.kind === 'omitted' || row.perplexity.kind === 'sync_failed') {
    out.push('perplexity');
  }
  if (
    row.chatgpt.kind === 'omitted' ||
    row.chatgpt.kind === 'negative_context' ||
    row.chatgpt.kind === 'sync_failed'
  ) {
    out.push('chatgpt');
  }
  if (
    row.claude.kind === 'omitted' ||
    row.claude.kind === 'negative_context' ||
    row.claude.kind === 'sync_failed'
  ) {
    out.push('claude');
  }
  return out;
}

export function isFullyCitedNumberOne(row: VisibilityRow): boolean {
  const googleOk =
    row.googleAio.kind === 'cited' && row.googleAio.rank === 1;
  const pplxOk =
    row.perplexity.kind === 'cited' && row.perplexity.rank === 1;
  const gptOk =
    row.chatgpt.kind === 'inline_link' || row.chatgpt.kind === 'text_mention';
  const claudeOk =
    row.claude.kind === 'inline_link' || row.claude.kind === 'text_mention';
  return googleOk && pplxOk && gptOk && claudeOk;
}

export function isPartiallyOmitted(row: VisibilityRow): boolean {
  if (isOmittedEverywhere(row) || isFullyCitedNumberOne(row)) return false;
  const citedCount = [
    row.googleAio.kind === 'cited',
    row.perplexity.kind === 'cited',
    row.chatgpt.kind === 'inline_link' || row.chatgpt.kind === 'text_mention',
    row.claude.kind === 'inline_link' || row.claude.kind === 'text_mention',
  ].filter(Boolean).length;
  return citedCount > 0 && citedCount < 4;
}

export function isOutranked(row: VisibilityRow): boolean {
  if (row.competitorThreat.kind === 'dominating') return false;
  if (row.competitorThreat.kind === 'threat') {
    return row.competitorThreat.winners.length > 0;
  }
  return false;
}

export function topOptimizeEngine(row: VisibilityRow): TrackedEngine | 'top' {
  const failed = failedEngines(row);
  if (failed.length === 1) return failed[0]!;
  return 'top';
}

export function engineLabel(engine: TrackedEngine | 'top'): string {
  switch (engine) {
    case 'google_aio':
      return 'Google AIO';
    case 'perplexity':
      return 'Perplexity';
    case 'chatgpt':
      return 'ChatGPT';
    case 'claude':
      return 'Claude';
    case 'top':
      return 'Top Engine';
  }
}

export function applyRagOnlyMask(
  citation: GoogleAioCitation | PerplexityCitation,
  chatGptMode: 'live_web' | 'base_knowledge'
): GoogleAioCitation | PerplexityCitation {
  if (chatGptMode === 'base_knowledge') {
    return { kind: 'na_rag' };
  }
  return citation;
}

export function applyRagOnlyLlmMask(
  citation: LlmCitation,
  engine: 'chatgpt' | 'claude',
  chatGptMode: 'live_web' | 'base_knowledge',
  fetchedBase: boolean
): LlmCitation {
  if (engine === 'chatgpt' && chatGptMode === 'base_knowledge' && !fetchedBase) {
    return { ...citation, loading: false };
  }
  return citation;
}

export function competitorMcRefIds(threat: CompetitorThreat): string[] {
  if (threat.kind !== 'threat') return [];
  return threat.winners
    .map((w) => w.mcRefId)
    .filter((id): id is string => Boolean(id));
}

/** Citation share formula: Top-3 Citations / (Active Non-Suspended × Active Engines) */
export function computeCitationShare(
  top3Citations: number,
  activeNonSuspendedPrompts: number,
  activeEngines: number
): number {
  const denom = activeNonSuspendedPrompts * activeEngines;
  if (denom <= 0) return 0;
  return Math.min(1, top3Citations / denom);
}

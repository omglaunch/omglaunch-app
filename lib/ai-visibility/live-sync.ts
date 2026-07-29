/**
 * Orchestrate live Force Sync for one visibility row.
 * Updates Perplexity / ChatGPT / Claude; leaves Google AIO unchanged (deferred).
 */

import {
  AI_VISIBILITY_CREDIT_PER_ENGINE,
  LIVE_FORCE_SYNC_ENGINES,
  type LiveForceSyncEngine,
} from '@/lib/ai-visibility/constants';
import {
  buildLiveCompetitorThreat,
  mapLlmCitation,
  mapPerplexityCitation,
  persistenceFromLiveSync,
  pushPersistenceTrend,
} from '@/lib/ai-visibility/citation-mappers';
import { queryLiveEngine } from '@/lib/ai-visibility/live-engines';
import {
  cacheSyncFailed,
  checkpointForceSync,
  runEgressBatches,
} from '@/lib/ai-visibility/sync-policy';
import type {
  LlmCitation,
  PerplexityCitation,
  VisibilityRow,
} from '@/lib/ai-visibility/types';
import { resolveLlmCredential } from '@/lib/llm/credentials';

export type LiveForceSyncResult = {
  row: VisibilityRow;
  enginesSynced: LiveForceSyncEngine[];
  enginesFailed: LiveForceSyncEngine[];
  enginesMissingKey: LiveForceSyncEngine[];
  /** Engines that will burn master-key credits (pre-charge guidance). */
  billableEngines: LiveForceSyncEngine[];
  creditsToCharge: number;
};

export async function previewLiveForceSyncCredits(
  workspaceId: string
): Promise<{
  billableEngines: LiveForceSyncEngine[];
  creditsToCharge: number;
}> {
  const billableEngines: LiveForceSyncEngine[] = [];

  for (const engine of LIVE_FORCE_SYNC_ENGINES) {
    const provider =
      engine === 'chatgpt'
        ? 'openai'
        : engine === 'claude'
          ? 'anthropic'
          : 'perplexity';
    const cred = await resolveLlmCredential(workspaceId, provider);
    if (cred?.usesCredits) billableEngines.push(engine);
  }

  return {
    billableEngines,
    creditsToCharge: billableEngines.length * AI_VISIBILITY_CREDIT_PER_ENGINE,
  };
}

export async function runLiveForceSync(opts: {
  workspaceId: string;
  row: VisibilityRow;
  deepScan?: boolean;
}): Promise<LiveForceSyncResult> {
  const { workspaceId, row } = opts;
  const checkpoint = checkpointForceSync();

  const preview = await previewLiveForceSyncCredits(workspaceId);

  const results = await runEgressBatches(
    LIVE_FORCE_SYNC_ENGINES.map((engine) => ({
      promptId: row.promptId,
      engine,
      mode: 'live_web' as const,
    })),
    async (item) =>
      queryLiveEngine(
        workspaceId,
        item.engine as LiveForceSyncEngine,
        row.prompt,
        row.geoTarget
      ),
    { batchSize: 3, allowBaseKnowledge: false }
  );

  let perplexity: PerplexityCitation = row.perplexity;
  let chatgpt: LlmCitation = row.chatgpt;
  let claude: LlmCitation = row.claude;
  let perplexityUrls: string[] = [];
  let chatgptUrls: string[] = [];
  let claudeUrls: string[] = [];

  const enginesSynced: LiveForceSyncEngine[] = [];
  const enginesFailed: LiveForceSyncEngine[] = [];
  const enginesMissingKey: LiveForceSyncEngine[] = [];

  for (const result of results) {
    if (result.ok) {
      enginesSynced.push(result.engine);
      if (result.engine === 'perplexity') {
        perplexityUrls = result.urls;
        perplexity = mapPerplexityCitation(
          result.answer,
          result.urls,
          row.brandAliases
        );
      } else if (result.engine === 'chatgpt') {
        chatgptUrls = result.urls;
        chatgpt = await mapLlmCitation(
          result.answer,
          result.urls,
          row.brandAliases
        );
      } else {
        claudeUrls = result.urls;
        claude = await mapLlmCitation(
          result.answer,
          result.urls,
          row.brandAliases
        );
      }
      continue;
    }

    if (result.reason === 'missing_key') {
      enginesMissingKey.push(result.engine);
    } else {
      enginesFailed.push(result.engine);
    }
    cacheSyncFailed(row.promptId, result.engine);

    if (result.engine === 'perplexity') {
      perplexity = { kind: 'sync_failed' };
    } else if (result.engine === 'chatgpt') {
      chatgpt = { kind: 'sync_failed' };
    } else {
      claude = { kind: 'sync_failed' };
    }
  }

  const persistenceNext = persistenceFromLiveSync({
    perplexity,
    chatgpt,
    claude,
  });

  const allLiveFailed =
    enginesSynced.length === 0 &&
    (enginesFailed.length > 0 || enginesMissingKey.length > 0);

  const next: VisibilityRow = {
    ...row,
    perplexity,
    chatgpt,
    claude,
    // Google AIO deferred — preserve prior vault value.
    googleAio: row.googleAio,
    competitorThreat: buildLiveCompetitorThreat({
      perplexity,
      chatgpt,
      claude,
      perplexityUrls,
      chatgptUrls,
      claudeUrls,
      brandAliases: row.brandAliases,
    }),
    persistenceTrend: pushPersistenceTrend(
      row.persistenceTrend,
      persistenceNext
    ),
    lastSyncedAt: checkpoint.lastActionAt,
    lastActionAt: checkpoint.lastActionAt,
    updatedAt: checkpoint.lastActionAt,
    nextCronRun: checkpoint.nextCronRun,
    deepScanEnabled: opts.deepScan ?? row.deepScanEnabled,
    rowSyncState: allLiveFailed ? 'failed' : 'idle',
  };

  return {
    row: next,
    enginesSynced,
    enginesFailed,
    enginesMissingKey,
    billableEngines: preview.billableEngines,
    creditsToCharge: preview.creditsToCharge,
  };
}

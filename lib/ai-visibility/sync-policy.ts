/**
 * Sync tiering, cron checkpointing, egress limiting, and volume heartbeat rules.
 * Base Knowledge syncs are EXCLUDED from all automated recurring cron jobs.
 */

import { SCRAPE_BATCH_SIZE, SYNC_FAILED_TTL_MS } from '@/lib/ai-visibility/types';

export type CronTier = 'high_volume_48h' | 'low_volume_weekly' | 'suspended';

export function resolveCronTier(aiSearchVol: number | null, confirmed: boolean): CronTier {
  // Zero-volume heartbeat: ONLY confirmed integer 0 suspends. NULL/timeout ≠ 0.
  if (confirmed && aiSearchVol === 0) return 'suspended';
  if (!confirmed || aiSearchVol === null) return 'low_volume_weekly';
  if (aiSearchVol >= 1000) return 'high_volume_48h';
  return 'low_volume_weekly';
}

export function nextCronRunIso(
  tier: CronTier,
  from: Date = new Date()
): string | null {
  if (tier === 'suspended') return null;
  const d = new Date(from);
  if (tier === 'high_volume_48h') d.setHours(d.getHours() + 48);
  else d.setDate(d.getDate() + 7);
  return d.toISOString();
}

/** Manual Force Sync MUST overwrite next_cron_run for that row. */
export function checkpointForceSync(now: Date = new Date()): {
  nextCronRun: string;
  lastActionAt: string;
} {
  return {
    nextCronRun: nextCronRunIso('high_volume_48h', now) ?? now.toISOString(),
    lastActionAt: now.toISOString(),
  };
}

export type EgressQueueItem = {
  promptId: string;
  engine: string;
  mode: 'live_web' | 'base_knowledge';
};

/**
 * Concurrency egress limiter — queue outbound scrapes in batches (max 50).
 * Base Knowledge jobs must never enter automated cron queues.
 */
export async function runEgressBatches<T>(
  items: EgressQueueItem[],
  worker: (item: EgressQueueItem) => Promise<T>,
  opts?: { batchSize?: number; allowBaseKnowledge?: boolean }
): Promise<T[]> {
  const batchSize = opts?.batchSize ?? SCRAPE_BATCH_SIZE;
  const filtered = items.filter((item) => {
    if (item.mode === 'base_knowledge' && !opts?.allowBaseKnowledge) {
      return false;
    }
    return true;
  });

  const results: T[] = [];
  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    const part = await Promise.all(batch.map(worker));
    results.push(...part);
  }
  return results;
}

const syncFailedCache = new Map<string, number>();

export function cacheSyncFailed(promptId: string, engine: string) {
  syncFailedCache.set(`${promptId}:${engine}`, Date.now() + SYNC_FAILED_TTL_MS);
}

export function isSyncFailedCached(promptId: string, engine: string): boolean {
  const until = syncFailedCache.get(`${promptId}:${engine}`);
  if (!until) return false;
  if (Date.now() > until) {
    syncFailedCache.delete(`${promptId}:${engine}`);
    return false;
  }
  return true;
}

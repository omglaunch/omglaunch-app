import { STAGING_HARD_CEILING } from './types';

/**
 * Hard global capacity ceiling.
 * True ceiling = Math.min(100, remainingAccountLimit)
 */
export function resolveCapacityCeiling(remainingAccountLimit: number): number {
  const account = Number.isFinite(remainingAccountLimit)
    ? Math.max(0, Math.floor(remainingAccountLimit))
    : STAGING_HARD_CEILING;
  return Math.min(STAGING_HARD_CEILING, account);
}

export function remainingStagingSlots(
  currentCount: number,
  remainingAccountLimit: number
): number {
  const ceiling = resolveCapacityCeiling(remainingAccountLimit);
  return Math.max(0, ceiling - currentCount);
}

/**
 * Monthly sync cost formula:
 * Selected Count × Active Default Engines × Sync Frequency Multiplier
 * (optionally scaled by creditsPerEngineSync)
 */
export function estimateMonthlySyncCredits(opts: {
  selectedCount: number;
  activeDefaultEngines: number;
  syncFrequencyMultiplier: number;
  creditsPerEngineSync?: number;
}): number {
  const {
    selectedCount,
    activeDefaultEngines,
    syncFrequencyMultiplier,
    creditsPerEngineSync = 1,
  } = opts;
  if (selectedCount <= 0) return 0;
  return Math.round(
    selectedCount *
      activeDefaultEngines *
      syncFrequencyMultiplier *
      creditsPerEngineSync
  );
}

export const CAPACITY_REACHED_MESSAGE =
  'Capacity Reached. Please commit or clear rows before importing more.';

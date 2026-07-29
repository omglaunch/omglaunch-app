import { getPrisma } from '@/lib/prisma';
import { SYSTEM_AUDIT_ACTOR } from '@/lib/audit/brand-manifest-audit';
import {
  DomainProfileRegenerationError,
  regenerateDomainProfileDraft,
} from './regenerate';

const DEFAULT_DEBOUNCE_MS = 30_000;

type TimerHost = typeof globalThis & {
  __domainManifestRegenTimers?: Map<string, NodeJS.Timeout>;
};

function getTimerMap(): Map<string, NodeJS.Timeout> {
  const host = globalThis as TimerHost;
  if (!host.__domainManifestRegenTimers) {
    host.__domainManifestRegenTimers = new Map();
  }
  return host.__domainManifestRegenTimers;
}

export function getDomainManifestRegenDebounceMs(): number {
  const raw = process.env.DOMAIN_MANIFEST_REGEN_DEBOUNCE_MS?.trim();
  if (!raw) return DEFAULT_DEBOUNCE_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DEBOUNCE_MS;
}

export function isManifestRegenDue(
  requestedAt: Date | null | undefined,
  completedAt: Date | null | undefined,
  now = new Date()
): boolean {
  if (!requestedAt) return false;
  if (now.getTime() - requestedAt.getTime() < getDomainManifestRegenDebounceMs()) {
    return false;
  }
  if (completedAt && completedAt >= requestedAt) {
    return false;
  }
  return true;
}

export async function flushDomainManifestRegenForProject(
  projectId: string
): Promise<{ regenerated: boolean; version?: number; error?: string }> {
  const profile = await getPrisma().aeoBrandProfile.findUnique({
    where: { projectId },
    select: {
      manifestRegenRequestedAt: true,
      manifestRegenCompletedAt: true,
    },
  });

  if (
    !profile ||
    !isManifestRegenDue(profile.manifestRegenRequestedAt, profile.manifestRegenCompletedAt)
  ) {
    return { regenerated: false };
  }

  const requestedAt = profile.manifestRegenRequestedAt!;

  try {
    const project = await getPrisma().project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) {
      return { regenerated: false, error: 'Project not found' };
    }

    const result = await regenerateDomainProfileDraft(projectId, {
      workspaceId: project.workspaceId,
      actor: SYSTEM_AUDIT_ACTOR,
      source: 'brand_save_debounce',
    });
    await getPrisma().aeoBrandProfile.update({
      where: { projectId },
      data: { manifestRegenCompletedAt: requestedAt },
    });
    return { regenerated: true, version: result.draftVersion };
  } catch (error) {
    const message =
      error instanceof DomainProfileRegenerationError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Manifest regeneration failed';
    console.warn(`[domain-profile/debounced-regen] Failed for ${projectId}:`, error);
    return { regenerated: false, error: message };
  }
}

export async function processDueDomainManifestRegens(options?: {
  limit?: number;
}): Promise<{ processed: number; regenerated: number; errors: number }> {
  const limit = options?.limit ?? 50;
  const debounceMs = getDomainManifestRegenDebounceMs();
  const dueBefore = new Date(Date.now() - debounceMs);

  const candidates = await getPrisma().aeoBrandProfile.findMany({
    where: {
      manifestRegenRequestedAt: { not: null, lte: dueBefore },
    },
    select: {
      projectId: true,
      manifestRegenRequestedAt: true,
      manifestRegenCompletedAt: true,
    },
    orderBy: { manifestRegenRequestedAt: 'asc' },
    take: limit * 3,
  });

  let processed = 0;
  let regenerated = 0;
  let errors = 0;

  for (const candidate of candidates) {
    if (processed >= limit) break;
    if (
      !isManifestRegenDue(
        candidate.manifestRegenRequestedAt,
        candidate.manifestRegenCompletedAt
      )
    ) {
      continue;
    }

    processed += 1;
    const result = await flushDomainManifestRegenForProject(candidate.projectId);
    if (result.regenerated) {
      regenerated += 1;
    } else if (result.error) {
      errors += 1;
    }
  }

  return { processed, regenerated, errors };
}

/** In-process debounce timer — coalesces rapid saves within one Node process. */
export function scheduleDebouncedDomainManifestRegen(projectId: string): void {
  const timers = getTimerMap();
  const existing = timers.get(projectId);
  if (existing) {
    clearTimeout(existing);
  }

  const debounceMs = getDomainManifestRegenDebounceMs();
  const timer = setTimeout(() => {
    timers.delete(projectId);
    void flushDomainManifestRegenForProject(projectId).catch(error => {
      console.warn(
        `[domain-profile/debounced-regen] Timer flush failed for ${projectId}:`,
        error
      );
    });
  }, debounceMs);

  if (typeof timer === 'object' && 'unref' in timer && typeof timer.unref === 'function') {
    timer.unref();
  }

  timers.set(projectId, timer);
}

/** Mark a project manifest stale and schedule debounced regeneration. */
export function notifyDomainManifestBrandChanged(projectId: string): void {
  scheduleDebouncedDomainManifestRegen(projectId);
}

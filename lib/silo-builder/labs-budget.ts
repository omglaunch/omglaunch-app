import { getPrisma } from '@/lib/prisma';
import { assertIntegrationEnabled } from '@/lib/admin/circuit-breaker';

/**
 * Labs endpoints counted toward the daily workspace call cap.
 * Includes Silo enrich + ranked keywords + Research/Audit ideas paths.
 */
const LABS_URL_MARKERS = [
  'keyword_overview',
  'bulk_keyword_difficulty',
  'ranked_keywords',
  'keyword_ideas',
  'related_keywords',
] as const;

/** Default daily Labs call cap per workspace (0 = unlimited). Override via env. */
const DEFAULT_DAILY_CALL_CAP = 500;

export class LabsBudgetExceededError extends Error {
  readonly used: number;
  readonly cap: number;
  readonly planned: number;

  constructor(params: { used: number; cap: number; planned: number }) {
    super(
      `DataForSEO Labs daily workspace budget exceeded (${params.used}+${params.planned} calls > ${params.cap} cap). Try again tomorrow, raise DATAFORSEO_LABS_DAILY_WORKSPACE_CALL_CAP, or enrich fewer keywords.`
    );
    this.name = 'LabsBudgetExceededError';
    this.used = params.used;
    this.cap = params.cap;
    this.planned = params.planned;
  }
}

export function isLabsBudgetExceededError(
  error: unknown
): error is LabsBudgetExceededError {
  return error instanceof LabsBudgetExceededError;
}

export function estimateLabsTasksForKeywords(keywordCount: number): number {
  if (keywordCount <= 0) {
    return 0;
  }
  // One overview task per 100 keywords + optional bulk KD task.
  return Math.ceil(keywordCount / 100) + 1;
}

/** One Labs task for ranked_keywords/live. */
export function estimateLabsTasksForRankedKeywords(): number {
  return 1;
}

function resolveDailyCallCap(): number {
  const raw = process.env.DATAFORSEO_LABS_DAILY_WORKSPACE_CALL_CAP?.trim();
  if (raw === undefined || raw === '') {
    return DEFAULT_DAILY_CALL_CAP;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DAILY_CALL_CAP;
  }
  return Math.floor(parsed);
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/** Count today's Labs-related health log rows for a workspace. */
export async function countWorkspaceLabsCallsToday(
  workspaceId: string
): Promise<number> {
  const prisma = getPrisma();
  const since = startOfUtcDay();

  const rows = await prisma.integrationHealthLog.findMany({
    where: {
      workspaceId,
      integrationType: 'DATAFORSEO',
      createdAt: { gte: since },
      OR: LABS_URL_MARKERS.map(marker => ({
        targetUrl: { contains: marker },
      })),
    },
    select: { id: true },
  });

  return rows.length;
}

export async function getWorkspaceLabsBudgetSnapshot(workspaceId: string): Promise<{
  used: number;
  cap: number;
  remaining: number | null;
  estimatedUsdUsed: number;
}> {
  const used = await countWorkspaceLabsCallsToday(workspaceId);
  const cap = resolveDailyCallCap();
  return {
    used,
    cap,
    remaining: cap === 0 ? null : Math.max(0, cap - used),
    estimatedUsdUsed: Number((used * 0.012).toFixed(4)),
  };
}

/**
 * Guard workspace Labs spend. Cap 0 = unlimited.
 * Throws LabsBudgetExceededError when the planned calls would exceed the daily cap.
 */
export async function assertSiloLabsBudget(
  workspaceId: string,
  plannedCalls: number
): Promise<void> {
  const cap = resolveDailyCallCap();
  if (cap === 0 || plannedCalls <= 0) {
    return;
  }

  const used = await countWorkspaceLabsCallsToday(workspaceId);
  if (used + plannedCalls > cap) {
    throw new LabsBudgetExceededError({ used, cap, planned: plannedCalls });
  }
}

/** Alias — budget applies to all Labs callers, not only Silo. */
export const assertLabsBudget = assertSiloLabsBudget;

/** One Labs task (related_keywords / keyword_ideas / related questions). */
export function estimateLabsTasksForResearchSeed(): number {
  return 1;
}

/**
 * Gate a Research/Audit Labs live fetch: circuit breaker + daily workspace cap.
 * Call only on cache miss, immediately before the live HTTP request.
 */
export async function assertLabsLiveFetchAllowed(
  workspaceId: string,
  plannedCalls = 1
): Promise<void> {
  await assertIntegrationEnabled('DATAFORSEO');
  await assertLabsBudget(workspaceId, plannedCalls);
}

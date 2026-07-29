import type { CompetitorCompareResult } from '@/lib/competitor-compare-data';

export const COMPETITOR_AUDITS_HISTORY_KEY = 'competitor_audits_history';

export const MAX_SAVED_COMPETITOR_AUDITS = 25;

export type SavedCompetitorAudit = {
  id: string;
  savedAt: string;
  targetKeyword: string;
  yourUrl: string;
  competitorUrls: string[];
  result: CompetitorCompareResult;
  projectId?: string;
};

function isValidCompareResult(value: unknown): value is CompetitorCompareResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as CompetitorCompareResult;
  return (
    typeof result.targetKeyword === 'string' &&
    !!result.yourPage &&
    typeof result.yourPage.url === 'string' &&
    Array.isArray(result.competitors) &&
    Array.isArray(result.semanticGaps) &&
    typeof result.analyzedAt === 'string'
  );
}

function isValidSavedAudit(value: unknown): value is SavedCompetitorAudit {
  if (!value || typeof value !== 'object') return false;

  const audit = value as SavedCompetitorAudit;
  return (
    typeof audit.id === 'string' &&
    typeof audit.savedAt === 'string' &&
    typeof audit.targetKeyword === 'string' &&
    typeof audit.yourUrl === 'string' &&
    Array.isArray(audit.competitorUrls) &&
    isValidCompareResult(audit.result)
  );
}

export function loadSavedCompetitorAudits(): SavedCompetitorAudit[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(COMPETITOR_AUDITS_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidSavedAudit);
  } catch {
    return [];
  }
}

export function persistSavedCompetitorAudits(audits: SavedCompetitorAudit[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(COMPETITOR_AUDITS_HISTORY_KEY, JSON.stringify(audits));
  } catch (error) {
    console.error('[competitor-audit-history] Failed to persist audits:', error);
  }
}

export function createSavedCompetitorAudit(input: {
  targetKeyword: string;
  yourUrl: string;
  competitorUrls: string[];
  result: CompetitorCompareResult;
}): SavedCompetitorAudit {
  return {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    targetKeyword: input.targetKeyword,
    yourUrl: input.yourUrl,
    competitorUrls: input.competitorUrls,
    result: input.result,
  };
}

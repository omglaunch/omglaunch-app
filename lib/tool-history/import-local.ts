import {
  ANALYSIS_AI_CACHE_PREFIX,
  ANALYSIS_AI_LAST_SESSION_KEY,
  type AnalysisCacheEntry,
  SEO_ANALYSIS_CACHE_PREFIX,
  SEO_ANALYSIS_LAST_SESSION_KEY,
  SEMANTIC_ANALYSIS_CACHE_PREFIX,
  SEMANTIC_ANALYSIS_LAST_SESSION_KEY,
} from '@/lib/analysis-cache';
import type { SavedCompetitorAudit } from '@/lib/competitor-audit-history';
import { LEGACY_TOOL_SLUG_ALIASES } from '@/lib/tool-history/registry';
import { localMigrationFlag } from '@/lib/tool-history/constants';
import { migrateToolHistoryFromClient } from '@/lib/tool-history/client';
import type { ToolSlug } from '@/lib/tool-history/types';
import { normalizeAnalysisUrl } from '@/lib/analysis-state';

export type LocalHistoryImportEntry = {
  identifier: string;
  resultData: unknown;
  createdAt?: string;
};

function readJsonStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function collectAnalysisCacheEntries(prefix: string): LocalHistoryImportEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const entries: LocalHistoryImportEntry[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(`${prefix}:`)) {
      continue;
    }

    const cached = readJsonStorage<AnalysisCacheEntry<unknown>>(key);
    if (!cached?.data) {
      continue;
    }

    const identifier = cached.url || key.slice(prefix.length + 1);
    entries.push({
      identifier,
      resultData: {
        data: cached.data,
        url: cached.url,
        keyword: cached.keyword,
        timestamp: cached.timestamp,
        cacheKey: key,
      },
      createdAt: Number.isFinite(cached.timestamp)
        ? new Date(cached.timestamp).toISOString()
        : undefined,
    });
  }

  return entries;
}

function clearAnalysisCachePrefix(prefix: string, lastSessionKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(`${prefix}:`)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => window.localStorage.removeItem(key));
  window.localStorage.removeItem(lastSessionKey);
}

export function collectSeoAnalysisLocalEntries(): LocalHistoryImportEntry[] {
  return collectAnalysisCacheEntries(SEO_ANALYSIS_CACHE_PREFIX);
}

export function collectSemanticAnalysisLocalEntries(): LocalHistoryImportEntry[] {
  return collectAnalysisCacheEntries(SEMANTIC_ANALYSIS_CACHE_PREFIX);
}

export function collectAnalysisAiLocalEntries(): LocalHistoryImportEntry[] {
  return collectAnalysisCacheEntries(ANALYSIS_AI_CACHE_PREFIX);
}

export function collectCompetitorCompareLocalEntries(): LocalHistoryImportEntry[] {
  const audits = readJsonStorage<SavedCompetitorAudit[]>('competitor_audits_history');
  if (!Array.isArray(audits)) {
    return [];
  }

  return audits.map(audit => ({
    identifier: audit.targetKeyword.trim() || audit.yourUrl,
    resultData: audit,
    createdAt: audit.savedAt,
  }));
}

export function clearSeoAnalysisLocalStorage(): void {
  clearAnalysisCachePrefix(SEO_ANALYSIS_CACHE_PREFIX, SEO_ANALYSIS_LAST_SESSION_KEY);
}

export function clearSemanticAnalysisLocalStorage(): void {
  clearAnalysisCachePrefix(
    SEMANTIC_ANALYSIS_CACHE_PREFIX,
    SEMANTIC_ANALYSIS_LAST_SESSION_KEY
  );
}

export function clearAnalysisAiLocalStorage(): void {
  clearAnalysisCachePrefix(ANALYSIS_AI_CACHE_PREFIX, ANALYSIS_AI_LAST_SESSION_KEY);
}

export function clearCompetitorCompareLocalStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem('competitor_audits_history');
}

const LOCAL_COLLECTORS: Partial<Record<ToolSlug, () => LocalHistoryImportEntry[]>> = {
  'seo-analysis': collectSeoAnalysisLocalEntries,
  'semantic-analysis': collectSemanticAnalysisLocalEntries,
  'analysis-ai': collectAnalysisAiLocalEntries,
  'page-optimizer': collectCompetitorCompareLocalEntries,
};

const LOCAL_CLEARERS: Partial<Record<ToolSlug, () => void>> = {
  'seo-analysis': clearSeoAnalysisLocalStorage,
  'semantic-analysis': clearSemanticAnalysisLocalStorage,
  'analysis-ai': clearAnalysisAiLocalStorage,
  'page-optimizer': clearCompetitorCompareLocalStorage,
};

export async function importLocalHistoryIfNeeded(
  tool: ToolSlug,
  workspaceId?: string
): Promise<number> {
  if (typeof window === 'undefined') {
    return 0;
  }

  const flag = localMigrationFlag(tool);
  const legacyAlias = Object.entries(LEGACY_TOOL_SLUG_ALIASES).find(([, slug]) => slug === tool)?.[0];
  const legacyFlag = legacyAlias ? localMigrationFlag(legacyAlias) : null;

  if (
    window.localStorage.getItem(flag) === '1' ||
    (legacyFlag && window.localStorage.getItem(legacyFlag) === '1')
  ) {
    return 0;
  }

  const collect = LOCAL_COLLECTORS[tool];
  if (!collect) {
    window.localStorage.setItem(flag, '1');
    return 0;
  }

  const entries = collect();
  if (entries.length === 0) {
    window.localStorage.setItem(flag, '1');
    return 0;
  }

  const imported = await migrateToolHistoryFromClient(tool, { entries, workspaceId });
  LOCAL_CLEARERS[tool]?.();
  window.localStorage.setItem(flag, '1');
  return imported;
}

export function buildAnalysisIdentifier(url: string, keyword = ''): string {
  const trimmedUrl = normalizeAnalysisUrl(url.trim());
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    return trimmedUrl;
  }
  return `${trimmedUrl}::${trimmedKeyword}`;
}

export function buildSemanticIdentifier(
  url: string,
  keyword: string,
  locationCode: number
): string {
  return `${buildAnalysisIdentifier(url, keyword)}::${locationCode}`;
}

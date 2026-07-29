import { normalizeAnalysisUrl } from '@/lib/analysis-state';
import {
  normalizeSemanticCacheData,
  type SemanticAnalysisCacheData,
  type SemanticAnalysisResult,
} from '@/lib/semantic-metrics';
import { buildSemanticIdentifier } from '@/lib/tool-history/import-local';

type StoredSemanticHistoryPayload = {
  data: unknown;
  url?: string;
  keyword?: string;
  timestamp?: number;
  projectId?: string;
};

export type SemanticHistoryRecord = {
  id: string;
  workspaceId: string;
  identifier: string;
  resultData: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type SemanticHistoryCleanupResult = {
  groupsProcessed: number;
  duplicateGroups: number;
  recordsDeleted: number;
  recordsUpdated: number;
};

function isStoredSemanticHistoryPayload(value: unknown): value is StoredSemanticHistoryPayload {
  return Boolean(value && typeof value === 'object' && 'data' in value);
}

function parseLocationCodeFromIdentifier(identifier: string): number | null {
  const parts = identifier.split('::');
  const last = parts[parts.length - 1];
  const parsed = Number(last);

  if (!Number.isFinite(parsed) || parts.length < 3) {
    return null;
  }

  return parsed;
}

export function normalizeSemanticHistoryIdentifier(identifier: string): string {
  const parts = identifier.split('::');
  const locationCode = parseLocationCodeFromIdentifier(identifier);

  if (locationCode !== null && parts.length >= 3) {
    const url = parts[0] ?? '';
    const keyword = parts.slice(1, -1).join('::');
    return buildSemanticIdentifier(url, keyword, locationCode);
  }

  if (parts.length >= 2) {
    const url = parts[0] ?? '';
    const keyword = parts.slice(1).join('::');
    return normalizeAnalysisUrl(url) + (keyword ? `::${keyword.trim()}` : '');
  }

  return normalizeAnalysisUrl(identifier);
}

function extractCacheData(record: SemanticHistoryRecord): SemanticAnalysisCacheData | null {
  if (!isStoredSemanticHistoryPayload(record.resultData)) {
    return normalizeSemanticCacheData(record.resultData);
  }

  return normalizeSemanticCacheData(record.resultData.data);
}

function pickRicherSemanticResult(
  current: SemanticAnalysisResult,
  candidate: SemanticAnalysisResult
): SemanticAnalysisResult {
  if (candidate.criteria.length > current.criteria.length) {
    return candidate;
  }

  if (candidate.criteria.length < current.criteria.length) {
    return current;
  }

  if (candidate.totalWords > current.totalWords) {
    return candidate;
  }

  return current;
}

export function mergeSemanticHistoryRecords(
  records: SemanticHistoryRecord[]
): {
  mergedData: SemanticAnalysisCacheData;
  url: string;
  keyword: string;
  timestamp: number;
  normalizedIdentifier: string;
} | null {
  if (records.length === 0) {
    return null;
  }

  const sorted = [...records].sort(
    (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime()
  );

  let merged: SemanticAnalysisCacheData | null = null;
  let url = '';
  let keyword = '';
  let timestamp = 0;
  let normalizedIdentifier = normalizeSemanticHistoryIdentifier(sorted[0]?.identifier ?? '');

  for (const record of sorted) {
    const cacheData = extractCacheData(record);
    if (!cacheData) {
      continue;
    }

    normalizedIdentifier = normalizeSemanticHistoryIdentifier(record.identifier);

    if (!merged) {
      merged = cacheData;
    } else {
      merged = {
        semanticResult: pickRicherSemanticResult(
          merged.semanticResult,
          cacheData.semanticResult
        ),
        namedEntities: cacheData.namedEntities ?? merged.namedEntities,
        relatedKeywords: cacheData.relatedKeywords ?? merged.relatedKeywords,
        relatedQuestions: cacheData.relatedQuestions ?? merged.relatedQuestions,
      };
    }

    if (isStoredSemanticHistoryPayload(record.resultData)) {
      url = record.resultData.url ?? url;
      keyword = record.resultData.keyword ?? keyword;
      timestamp = Math.max(timestamp, record.resultData.timestamp ?? 0);
    }
  }

  if (!merged) {
    return null;
  }

  return {
    mergedData: merged,
    url: url || merged.semanticResult.url,
    keyword: keyword || merged.semanticResult.targetKeyword,
    timestamp: timestamp || Date.now(),
    normalizedIdentifier,
  };
}

export function groupSemanticHistoryRecords(
  records: SemanticHistoryRecord[]
): Map<string, SemanticHistoryRecord[]> {
  const groups = new Map<string, SemanticHistoryRecord[]>();

  for (const record of records) {
    const key = `${record.workspaceId}::${normalizeSemanticHistoryIdentifier(record.identifier)}`;
    const existing = groups.get(key) ?? [];
    existing.push(record);
    groups.set(key, existing);
  }

  return groups;
}

export function planSemanticHistoryCleanup(records: SemanticHistoryRecord[]): Array<{
  keepId: string;
  deleteIds: string[];
  normalizedIdentifier: string;
  mergedPayload: StoredSemanticHistoryPayload;
}> {
  const groups = groupSemanticHistoryRecords(records);
  const plans: Array<{
    keepId: string;
    deleteIds: string[];
    normalizedIdentifier: string;
    mergedPayload: StoredSemanticHistoryPayload;
  }> = [];

  for (const group of Array.from(groups.values())) {
    if (group.length <= 1) {
      const only = group[0];
      if (!only) {
        continue;
      }

      const merged = mergeSemanticHistoryRecords(group);
      if (!merged) {
        continue;
      }

      const normalizedIdentifier = merged.normalizedIdentifier;
      if (normalizedIdentifier === only.identifier) {
        continue;
      }

      plans.push({
        keepId: only.id,
        deleteIds: [],
        normalizedIdentifier,
        mergedPayload: {
          data: merged.mergedData,
          url: merged.url,
          keyword: merged.keyword,
          timestamp: merged.timestamp,
          projectId: only.workspaceId,
        },
      });
      continue;
    }

    const sorted = [...group].sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
    );
    const keep = sorted[0];
    if (!keep) {
      continue;
    }

    const merged = mergeSemanticHistoryRecords(group);
    if (!merged) {
      continue;
    }

    plans.push({
      keepId: keep.id,
      deleteIds: sorted.slice(1).map(record => record.id),
      normalizedIdentifier: merged.normalizedIdentifier,
      mergedPayload: {
        data: merged.mergedData,
        url: merged.url,
        keyword: merged.keyword,
        timestamp: merged.timestamp,
        projectId: keep.workspaceId,
      },
    });
  }

  return plans;
}

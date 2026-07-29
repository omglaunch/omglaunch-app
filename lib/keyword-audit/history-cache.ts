import { fetchLatestToolHistoryByIdentifier } from '@/lib/tool-history/client';
import { normalizeGeoInput, type KeywordAuditGeoInput } from '@/lib/keyword-audit/geo';
import {
  buildHistoryIdentifier,
  isKeywordAuditHistoryData,
  type KeywordAuditResult,
} from '@/lib/types/keyword-audit';

function geoMatchesResult(result: KeywordAuditResult, geo: KeywordAuditGeoInput): boolean {
  const expected = normalizeGeoInput(geo);
  const stored = normalizeGeoInput({
    country: result.country,
    city: result.city,
    language: result.language,
    device: result.device,
  });

  return (
    stored.country === expected.country &&
    (stored.city ?? '') === (expected.city ?? '') &&
    stored.language === expected.language &&
    stored.device === expected.device
  );
}

export async function loadLatestKeywordAuditFromHistory(options: {
  keyword: string;
  geo: KeywordAuditGeoInput;
  workspaceId: string;
}): Promise<{ result: KeywordAuditResult; historyId: string; cachedAt: number } | null> {
  const workspaceId = options.workspaceId.trim();
  if (!workspaceId) {
    return null;
  }

  const entry = await fetchLatestToolHistoryByIdentifier(
    'keyword-audit',
    buildHistoryIdentifier(options.keyword),
    workspaceId
  );

  if (!entry || !isKeywordAuditHistoryData(entry.resultData)) {
    return null;
  }

  if (!geoMatchesResult(entry.resultData, options.geo)) {
    return null;
  }

  return {
    result: entry.resultData,
    historyId: entry.id,
    cachedAt: Date.parse(entry.updatedAt),
  };
}

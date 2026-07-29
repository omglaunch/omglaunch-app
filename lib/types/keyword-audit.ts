export type KeywordAuditSubtopic = {
  heading: string;
  purpose: string;
};

export type KeywordAuditCompetitor = {
  url: string;
  title: string;
  domain: string;
};

export type KeywordAuditResult = {
  keyword: string;
  recommendedFormat: string;
  targetWordCount: number;
  userIntentCore: string;
  corePainPoints: [string, string, string];
  requiredSubtopics: KeywordAuditSubtopic[];
  serpFeaturesToTarget: string[];
  country?: string;
  city?: string;
  language?: string;
  device?: string;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  topCompetitors?: KeywordAuditCompetitor[];
};

function isSubtopic(value: unknown): value is KeywordAuditSubtopic {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as KeywordAuditSubtopic;

  return (
    typeof candidate.heading === 'string' &&
    candidate.heading.trim().length > 0 &&
    typeof candidate.purpose === 'string' &&
    candidate.purpose.trim().length > 0
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(item => typeof item === 'string' && item.trim().length > 0)
  );
}

function isCompetitor(value: unknown): value is KeywordAuditCompetitor {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as KeywordAuditCompetitor;
  return (
    typeof candidate.url === 'string' &&
    candidate.url.trim().length > 0 &&
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.domain === 'string' &&
    candidate.domain.trim().length > 0
  );
}

export function isKeywordAuditResult(value: unknown): value is KeywordAuditResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as KeywordAuditResult;

  return (
    typeof candidate.keyword === 'string' &&
    candidate.keyword.trim().length > 0 &&
    typeof candidate.recommendedFormat === 'string' &&
    candidate.recommendedFormat.trim().length > 0 &&
    typeof candidate.targetWordCount === 'number' &&
    Number.isFinite(candidate.targetWordCount) &&
    candidate.targetWordCount > 0 &&
    typeof candidate.userIntentCore === 'string' &&
    candidate.userIntentCore.trim().length > 0 &&
    Array.isArray(candidate.corePainPoints) &&
    candidate.corePainPoints.length === 3 &&
    candidate.corePainPoints.every(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    ) &&
    Array.isArray(candidate.requiredSubtopics) &&
    candidate.requiredSubtopics.length >= 4 &&
    candidate.requiredSubtopics.every(isSubtopic) &&
    isStringArray(candidate.serpFeaturesToTarget)
  );
}

export function isKeywordAuditHistoryData(value: unknown): value is KeywordAuditResult {
  return isKeywordAuditResult(value);
}

export function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

function coerceTargetWordCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0);
}

function normalizeSubtopics(value: unknown): KeywordAuditSubtopic[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const candidate = item as KeywordAuditSubtopic;
      const heading = candidate.heading?.trim() ?? '';
      const purpose = candidate.purpose?.trim() ?? '';

      if (!heading || !purpose) {
        return null;
      }

      return { heading, purpose };
    })
    .filter((item): item is KeywordAuditSubtopic => item !== null);
}

export function normalizeKeywordAuditPayload(
  raw: unknown,
  fallbackKeyword: string
): unknown {
  if (typeof raw !== 'object' || raw === null) {
    return raw;
  }

  const candidate = raw as Record<string, unknown>;
  const targetWordCount = coerceTargetWordCount(candidate.targetWordCount);
  const corePainPoints = normalizeStringArray(candidate.corePainPoints);
  const requiredSubtopics = normalizeSubtopics(candidate.requiredSubtopics);
  const serpFeaturesToTarget = normalizeStringArray(candidate.serpFeaturesToTarget);

  while (corePainPoints.length < 3) {
    corePainPoints.push('Needs deeper local market research to articulate this friction point.');
  }

  const keyword =
    typeof candidate.keyword === 'string' && candidate.keyword.trim().length > 0
      ? candidate.keyword.trim()
      : fallbackKeyword.trim();

  return {
    ...candidate,
    keyword,
    recommendedFormat:
      typeof candidate.recommendedFormat === 'string'
        ? candidate.recommendedFormat.trim()
        : candidate.recommendedFormat,
    targetWordCount,
    userIntentCore:
      typeof candidate.userIntentCore === 'string'
        ? candidate.userIntentCore.trim()
        : candidate.userIntentCore,
    corePainPoints: corePainPoints.slice(0, 3),
    requiredSubtopics,
    serpFeaturesToTarget,
  };
}

export function describeKeywordAuditValidationFailure(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return 'response was not a JSON object';
  }

  const candidate = value as KeywordAuditResult;

  if (typeof candidate.recommendedFormat !== 'string' || !candidate.recommendedFormat.trim()) {
    return 'missing recommendedFormat';
  }

  const wordCount = coerceTargetWordCount(candidate.targetWordCount);
  if (wordCount === null || wordCount <= 0) {
    return 'invalid targetWordCount';
  }

  if (typeof candidate.userIntentCore !== 'string' || !candidate.userIntentCore.trim()) {
    return 'missing userIntentCore';
  }

  const painPoints = normalizeStringArray(candidate.corePainPoints);
  if (painPoints.length < 3) {
    return `expected 3 corePainPoints, received ${painPoints.length}`;
  }

  const subtopics = normalizeSubtopics(candidate.requiredSubtopics);
  if (subtopics.length < 4) {
    return `expected at least 4 requiredSubtopics, received ${subtopics.length}`;
  }

  const serpFeatures = normalizeStringArray(candidate.serpFeaturesToTarget);
  if (serpFeatures.length === 0) {
    return 'missing serpFeaturesToTarget';
  }

  return 'unknown schema mismatch';
}

export function parseKeywordAuditJson(text: string, fallbackKeyword = ''): KeywordAuditResult {
  const cleaned = stripMarkdownJsonFence(text);
  const parsed = JSON.parse(cleaned) as unknown;
  const normalized = normalizeKeywordAuditPayload(parsed, fallbackKeyword);

  if (!isKeywordAuditResult(normalized)) {
    throw new Error(
      `Generated audit did not match the required schema (${describeKeywordAuditValidationFailure(normalized)})`
    );
  }

  return normalized;
}

export function buildHistoryIdentifier(keyword: string): string {
  return keyword.trim();
}

export function getRecommendedTitle(result: KeywordAuditResult): string {
  const firstSubtopic = result.requiredSubtopics[0]?.heading?.trim();
  if (firstSubtopic) {
    return firstSubtopic;
  }

  return result.keyword.trim();
}

export function formatSubtopicsBrief(result: KeywordAuditResult): string {
  const lines = [
    `# Content Brief: ${result.keyword}`,
    '',
    `**Format:** ${result.recommendedFormat}`,
    `**Target Word Count:** ${result.targetWordCount.toLocaleString()}`,
    `**Primary Intent:** ${result.userIntentCore}`,
    '',
    '## Required Subtopics',
    '',
  ];

  for (const subtopic of result.requiredSubtopics) {
    lines.push(`### ${subtopic.heading}`);
    lines.push(subtopic.purpose);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function extractKeywordAuditMetadata(result: unknown): {
  country?: string;
  city?: string;
  language?: string;
  device?: string;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  topCompetitors?: KeywordAuditCompetitor[];
} {
  if (typeof result !== 'object' || result === null) {
    return {};
  }

  const candidate = result as KeywordAuditResult;

  return {
    country: typeof candidate.country === 'string' ? candidate.country : undefined,
    city: typeof candidate.city === 'string' ? candidate.city : undefined,
    language: typeof candidate.language === 'string' ? candidate.language : undefined,
    device: typeof candidate.device === 'string' ? candidate.device : undefined,
    searchVolume:
      typeof candidate.searchVolume === 'number' ? candidate.searchVolume : candidate.searchVolume ?? undefined,
    keywordDifficulty:
      typeof candidate.keywordDifficulty === 'number'
        ? candidate.keywordDifficulty
        : candidate.keywordDifficulty ?? undefined,
    topCompetitors: Array.isArray(candidate.topCompetitors)
      ? candidate.topCompetitors.filter(isCompetitor)
      : undefined,
  };
}

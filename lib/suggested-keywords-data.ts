export type KeywordIntent =
  | 'Informational'
  | 'Commercial'
  | 'Transactional'
  | 'Navigational';

export type FunnelStage = 'TOFU' | 'MOFU' | 'BOFU';

export type EstimatedDifficulty = 'Low' | 'Medium' | 'High';

export type SuggestedKeyword = {
  keyword: string;
  intent: KeywordIntent;
  funnelStage: FunnelStage;
  suggestedFormat: string;
  estimatedDifficulty: EstimatedDifficulty;
  relevanceScore: number;
  angle: string;
};

export type SuggestedKeywordsResult = {
  seed: string;
  suggestions: SuggestedKeyword[];
};

export type SuggestedKeywordsHistoryData = {
  seed: string;
  seedKeyword: string;
  location?: string;
  suggestions: SuggestedKeyword[];
  generatedAt: string;
};

const VALID_INTENTS = new Set<string>([
  'Informational',
  'Commercial',
  'Transactional',
  'Navigational',
]);

const VALID_FUNNEL_STAGES = new Set<string>(['TOFU', 'MOFU', 'BOFU']);

const VALID_DIFFICULTIES = new Set<string>(['Low', 'Medium', 'High']);

function isSuggestedKeyword(value: unknown): value is SuggestedKeyword {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as SuggestedKeyword;

  return (
    typeof candidate.keyword === 'string' &&
    candidate.keyword.trim().length > 0 &&
    typeof candidate.intent === 'string' &&
    VALID_INTENTS.has(candidate.intent) &&
    typeof candidate.funnelStage === 'string' &&
    VALID_FUNNEL_STAGES.has(candidate.funnelStage) &&
    typeof candidate.suggestedFormat === 'string' &&
    candidate.suggestedFormat.trim().length > 0 &&
    typeof candidate.estimatedDifficulty === 'string' &&
    VALID_DIFFICULTIES.has(candidate.estimatedDifficulty) &&
    typeof candidate.relevanceScore === 'number' &&
    Number.isFinite(candidate.relevanceScore) &&
    candidate.relevanceScore >= 1 &&
    candidate.relevanceScore <= 100 &&
    typeof candidate.angle === 'string' &&
    candidate.angle.trim().length > 0
  );
}

export function isSuggestedKeywordsResult(value: unknown): value is SuggestedKeywordsResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as SuggestedKeywordsResult;

  return (
    typeof candidate.seed === 'string' &&
    candidate.seed.trim().length > 0 &&
    Array.isArray(candidate.suggestions) &&
    candidate.suggestions.length === 20 &&
    candidate.suggestions.every(isSuggestedKeyword)
  );
}

export function isSuggestedKeywordsHistoryData(
  value: unknown
): value is SuggestedKeywordsHistoryData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as SuggestedKeywordsHistoryData;

  return (
    typeof candidate.seed === 'string' &&
    typeof candidate.seedKeyword === 'string' &&
    Array.isArray(candidate.suggestions) &&
    candidate.suggestions.every(isSuggestedKeyword) &&
    typeof candidate.generatedAt === 'string'
  );
}

export function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function parseSuggestedKeywordsJson(text: string): SuggestedKeywordsResult {
  const cleaned = stripMarkdownJsonFence(text);
  const parsed = JSON.parse(cleaned) as unknown;

  if (!isSuggestedKeywordsResult(parsed)) {
    throw new Error(
      'Generated keywords did not match the required schema (exactly 20 valid suggestions)'
    );
  }

  return parsed;
}

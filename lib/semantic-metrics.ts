export interface SemanticOccurrence {
  current: number;
  maxCompetition: number;
}

export interface SemanticIdealRange {
  min: number;
  max: number;
}

export interface SemanticCriterion {
  expression: string;
  context: string;
  occurrence: SemanticOccurrence;
  idealOccurrence: SemanticIdealRange;
  frequencyInTitle: number;
  tfIdf: number;
  interestScore: number;
}

export interface SemanticAnalysisResult {
  url: string;
  targetKeyword: string;
  totalWords: number;
  semanticScore: number;
  criteria: SemanticCriterion[];
}

export type RelatedKeywordIntention =
  | 'commercial'
  | 'navigational'
  | 'informational'
  | 'transactional';

export type MonthlySearchPoint = {
  year: number;
  month: number;
  searchVolume: number;
};

export type ResearchSerpFeatures = {
  localPack: boolean;
  featuredSnippet: boolean;
};

export interface RelatedKeyword {
  expression: string;
  frequency: number;
  searchVolume: number;
  concurrence: number;
  cpc: number | null;
  difficulty: number | null;
  intention: RelatedKeywordIntention | null;
  interestScore: number;
  monthlySearches: MonthlySearchPoint[];
  serpFeatures: ResearchSerpFeatures;
  yoyChange: number | null;
  /** Raw Labs API item preserved for zero-cost SERP harvest on save. */
  rawLabsPayload?: unknown;
}

export interface RelatedQuestion {
  expression: string;
  searchVolume: number;
  interrogativeWord: string;
}

export type NamedEntityCategory =
  | 'Person'
  | 'Organization'
  | 'Location'
  | 'Product'
  | 'Concept';

export interface NamedEntity {
  entityName: string;
  category: NamedEntityCategory;
  salience: number;
  description: string;
  sourceUrl: string;
  sourceUrls: string[];
}

export interface EntityRelationship {
  source: string;
  target: string;
  label: string;
}

export interface NamedEntitiesResult {
  entities: NamedEntity[];
  relationships: EntityRelationship[];
  competitorOnlyEntities: NamedEntity[];
  userPageEntities: NamedEntity[];
}

export interface SemanticAnalysisCacheData {
  semanticResult: SemanticAnalysisResult;
  relatedKeywords: RelatedKeyword[] | null;
  relatedQuestions: RelatedQuestion[] | null;
  namedEntities: NamedEntitiesResult | null;
}

export function isValidSemanticAnalysisResult(data: unknown): data is SemanticAnalysisResult {
  if (!data || typeof data !== 'object') return false;

  const result = data as SemanticAnalysisResult;
  return (
    typeof result.url === 'string' &&
    typeof result.targetKeyword === 'string' &&
    typeof result.totalWords === 'number' &&
    typeof result.semanticScore === 'number' &&
    Array.isArray(result.criteria)
  );
}

export function isValidNamedEntity(data: unknown): data is NamedEntity {
  if (!data || typeof data !== 'object') return false;

  const entity = data as NamedEntity;
  const sourceUrls = entity.sourceUrls;
  const hasValidSourceUrls =
    sourceUrls === undefined ||
    (Array.isArray(sourceUrls) && sourceUrls.every(url => typeof url === 'string'));

  return (
    typeof entity.entityName === 'string' &&
    typeof entity.category === 'string' &&
    typeof entity.salience === 'number' &&
    typeof entity.description === 'string' &&
    (entity.sourceUrl === undefined || typeof entity.sourceUrl === 'string') &&
    hasValidSourceUrls
  );
}

export function normalizeNamedEntity(data: NamedEntity): NamedEntity {
  const sourceUrls =
    Array.isArray(data.sourceUrls) && data.sourceUrls.length > 0
      ? data.sourceUrls
      : data.sourceUrl
        ? [data.sourceUrl]
        : [];

  return {
    ...data,
    sourceUrl: data.sourceUrl ?? sourceUrls[0] ?? '',
    sourceUrls,
  };
}

export function normalizeNamedEntitiesResult(data: NamedEntitiesResult): NamedEntitiesResult {
  return {
    entities: data.entities.map(normalizeNamedEntity),
    relationships: data.relationships,
    competitorOnlyEntities: data.competitorOnlyEntities.map(normalizeNamedEntity),
    userPageEntities: data.userPageEntities.map(normalizeNamedEntity),
  };
}

export function isValidNamedEntitiesResult(data: unknown): data is NamedEntitiesResult {
  if (!data || typeof data !== 'object') return false;

  const result = data as NamedEntitiesResult;
  return (
    Array.isArray(result.entities) &&
    result.entities.every(isValidNamedEntity) &&
    Array.isArray(result.relationships) &&
    Array.isArray(result.competitorOnlyEntities) &&
    Array.isArray(result.userPageEntities)
  );
}

export function isValidRelatedQuestion(data: unknown): data is RelatedQuestion {
  if (!data || typeof data !== 'object') return false;

  const question = data as RelatedQuestion;
  return (
    typeof question.expression === 'string' &&
    typeof question.searchVolume === 'number' &&
    typeof question.interrogativeWord === 'string'
  );
}

export function isValidRelatedKeyword(data: unknown): data is RelatedKeyword {
  if (!data || typeof data !== 'object') return false;

  const keyword = data as RelatedKeyword;
  return (
    typeof keyword.expression === 'string' &&
    typeof keyword.frequency === 'number' &&
    typeof keyword.searchVolume === 'number' &&
    typeof keyword.concurrence === 'number' &&
    (keyword.cpc === null || typeof keyword.cpc === 'number') &&
    (keyword.difficulty === null || typeof keyword.difficulty === 'number') &&
    (keyword.intention === null || typeof keyword.intention === 'string') &&
    typeof keyword.interestScore === 'number'
  );
}

export function normalizeSemanticCacheData(data: unknown): SemanticAnalysisCacheData | null {
  if (isValidSemanticAnalysisResult(data)) {
    return {
      semanticResult: data,
      relatedKeywords: null,
      relatedQuestions: null,
      namedEntities: null,
    };
  }

  if (!data || typeof data !== 'object') return null;

  const payload = data as SemanticAnalysisCacheData;
  if (!isValidSemanticAnalysisResult(payload.semanticResult)) {
    return null;
  }

  const relatedKeywords =
    payload.relatedKeywords === null
      ? null
      : Array.isArray(payload.relatedKeywords) &&
          payload.relatedKeywords.every(isValidRelatedKeyword)
        ? payload.relatedKeywords
        : null;

  const relatedQuestions =
    payload.relatedQuestions === null || payload.relatedQuestions === undefined
      ? null
      : Array.isArray(payload.relatedQuestions) &&
          payload.relatedQuestions.every(isValidRelatedQuestion)
        ? payload.relatedQuestions
        : null;

  const namedEntities =
    payload.namedEntities === null || payload.namedEntities === undefined
      ? null
      : isValidNamedEntitiesResult(payload.namedEntities)
        ? normalizeNamedEntitiesResult(payload.namedEntities)
        : null;

  return { semanticResult: payload.semanticResult, relatedKeywords, relatedQuestions, namedEntities };
}

export function isValidSemanticCacheData(data: unknown): data is SemanticAnalysisCacheData {
  return normalizeSemanticCacheData(data) !== null;
}

export function isOccurrenceWithinIdeal(
  occurrence: SemanticOccurrence,
  idealOccurrence: SemanticIdealRange
): boolean {
  return (
    occurrence.current >= idealOccurrence.min && occurrence.current <= idealOccurrence.max
  );
}

export function formatIdealRange(range: SemanticIdealRange): string {
  return `${range.min} to ${range.max}`;
}

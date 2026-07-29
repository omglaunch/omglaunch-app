'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchPageAnalysis } from '@/lib/analysis/client-api';
import { fetchNamedEntities } from '@/app/actions/semantic-analysis';
import { runSemanticAnalysis } from '@/app/actions/seo-analysis';
import {
  buildAnalysisCacheKey,
  readAnalysisCache,
  SEMANTIC_ANALYSIS_CACHE_PREFIX,
  writeAnalysisCache,
  SEMANTIC_ANALYSIS_LAST_SESSION_KEY,
} from '@/lib/analysis-cache';
import type { AnalysisMetrics } from '@/lib/analysis-data';
import type { AuditReportData, AnalysisSession } from '@/lib/analysis-state';
import { normalizeAnalysisUrl, sessionsMatch } from '@/lib/analysis-state';
import {
  normalizeSemanticCacheData,
  type NamedEntitiesResult,
  type SemanticAnalysisCacheData,
  type SemanticAnalysisResult,
} from '@/lib/semantic-metrics';

type AnalysisContextValue = {
  session: AnalysisSession | null;
  technicalData: AnalysisMetrics | null;
  semanticData: SemanticAnalysisCacheData | null;
  auditReportData: AuditReportData | null;
  isRunningTechnical: boolean;
  isLoadingSemantic: boolean;
  isLoadingNamedEntities: boolean;
  technicalError: string | null;
  semanticError: string | null;
  entitiesError: string | null;
  entityLoadingStage: string | null;
  setSession: (url: string, keyword: string, locationCode: number) => void;
  setAuditReportData: (data: AuditReportData | null) => void;
  runTechnicalAnalysis: (
    url: string,
    keyword: string,
    locationCode: number
  ) => Promise<AnalysisMetrics | null>;
  ensureSemanticData: () => Promise<SemanticAnalysisResult | null>;
  ensureNamedEntities: () => Promise<NamedEntitiesResult | null>;
  resetAnalysis: () => void;
  matchesSession: (url: string, keyword: string) => boolean;
  importCachedSession: (
    session: AnalysisSession,
    data?: {
      semanticData?: SemanticAnalysisCacheData | null;
      technicalData?: AnalysisMetrics | null;
    }
  ) => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

function buildSemanticCacheKey(session: AnalysisSession): string {
  return buildAnalysisCacheKey(
    SEMANTIC_ANALYSIS_CACHE_PREFIX,
    session.url,
    session.keyword,
    session.locationCode
  );
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AnalysisSession | null>(null);
  const [technicalData, setTechnicalData] = useState<AnalysisMetrics | null>(null);
  const [semanticData, setSemanticData] = useState<SemanticAnalysisCacheData | null>(null);
  const [auditReportData, setAuditReportData] = useState<AuditReportData | null>(null);
  const [isRunningTechnical, setIsRunningTechnical] = useState(false);
  const [isLoadingSemantic, setIsLoadingSemantic] = useState(false);
  const [isLoadingNamedEntities, setIsLoadingNamedEntities] = useState(false);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [entitiesError, setEntitiesError] = useState<string | null>(null);
  const [entityLoadingStage, setEntityLoadingStage] = useState<string | null>(null);

  const setSession = useCallback((url: string, keyword: string, locationCode: number) => {
    const nextSession: AnalysisSession = {
      url: normalizeAnalysisUrl(url),
      keyword: keyword.trim(),
      locationCode,
    };

    setSessionState(current => {
      if (
        current &&
        normalizeAnalysisUrl(current.url) === nextSession.url &&
        current.keyword === nextSession.keyword &&
        current.locationCode === nextSession.locationCode
      ) {
        return current;
      }

      return nextSession;
    });
  }, []);

  const resetAnalysis = useCallback(() => {
    setSessionState(null);
    setTechnicalData(null);
    setSemanticData(null);
    setAuditReportData(null);
    setTechnicalError(null);
    setSemanticError(null);
    setEntitiesError(null);
    setIsRunningTechnical(false);
    setIsLoadingSemantic(false);
    setIsLoadingNamedEntities(false);
    setEntityLoadingStage(null);
  }, []);

  const matchesSession = useCallback(
    (url: string, keyword: string) => sessionsMatch(session, url, keyword),
    [session]
  );

  const importCachedSession = useCallback(
    (
      nextSession: AnalysisSession,
      data?: {
        semanticData?: SemanticAnalysisCacheData | null;
        technicalData?: AnalysisMetrics | null;
      }
    ) => {
      setSessionState(nextSession);
      if (data?.semanticData) {
        setSemanticData(data.semanticData);
      }
      if (data?.technicalData) {
        setTechnicalData(data.technicalData);
      }
    },
    []
  );

  const runTechnicalAnalysis = useCallback(
    async (url: string, keyword: string, locationCode: number) => {
      const trimmedUrl = url.trim();
      const trimmedKeyword = keyword.trim();

      if (!trimmedUrl || !trimmedKeyword) {
        setTechnicalError('URL and target keyword are required.');
        return null;
      }

      setSession(trimmedUrl, trimmedKeyword, locationCode);
      setSemanticData(null);
      setAuditReportData(null);
      setSemanticError(null);
      setEntitiesError(null);
      setIsRunningTechnical(true);
      setTechnicalError(null);

      try {
        const result = await fetchPageAnalysis(trimmedUrl);
        setTechnicalData(result);
        return result;
      } catch {
        setTechnicalError('Failed to run technical analysis. Check the URL and try again.');
        setTechnicalData(null);
        return null;
      } finally {
        setIsRunningTechnical(false);
      }
    },
    [setSession]
  );

  const persistSemanticCache = useCallback(
    (payload: SemanticAnalysisCacheData) => {
      if (!session) return;

      writeAnalysisCache(
        buildSemanticCacheKey(session),
        {
          data: payload,
          timestamp: Date.now(),
          url: session.url,
          keyword: session.keyword,
        },
        SEMANTIC_ANALYSIS_LAST_SESSION_KEY
      );
    },
    [session]
  );

  const ensureSemanticData = useCallback(async () => {
    if (!session) {
      setSemanticError('Run an analysis first to establish a URL and keyword.');
      return null;
    }

    if (semanticData?.semanticResult) {
      return semanticData.semanticResult;
    }

    const cacheKey = buildSemanticCacheKey(session);

    try {
      const cached = readAnalysisCache<SemanticAnalysisCacheData>(cacheKey);
      const normalized = cached ? normalizeSemanticCacheData(cached.data) : null;

      if (normalized?.semanticResult) {
        setSemanticData(normalized);
        setSemanticError(null);
        return normalized.semanticResult;
      }
    } catch {
      // Fall through to fetch.
    }

    setIsLoadingSemantic(true);
    setSemanticError(null);

    try {
      const result = await runSemanticAnalysis(
        session.url,
        session.keyword,
        session.locationCode
      );

      const payload: SemanticAnalysisCacheData = {
        semanticResult: result,
        relatedKeywords: semanticData?.relatedKeywords ?? null,
        relatedQuestions: semanticData?.relatedQuestions ?? null,
        namedEntities: semanticData?.namedEntities ?? null,
      };

      setSemanticData(payload);
      persistSemanticCache(payload);
      return result;
    } catch {
      setSemanticError('Failed to load semantic analysis. Please try again.');
      return null;
    } finally {
      setIsLoadingSemantic(false);
    }
  }, [persistSemanticCache, semanticData, session]);

  const ensureNamedEntities = useCallback(async () => {
    if (!session) {
      setEntitiesError('Run an analysis first to establish a URL and keyword.');
      return null;
    }

    if (semanticData?.namedEntities) {
      return semanticData.namedEntities;
    }

    const cacheKey = buildSemanticCacheKey(session);

    try {
      const cached = readAnalysisCache<SemanticAnalysisCacheData>(cacheKey);
      const normalized = cached ? normalizeSemanticCacheData(cached.data) : null;

      if (normalized?.namedEntities) {
        setSemanticData(current => ({
          semanticResult: current?.semanticResult ?? normalized.semanticResult,
          relatedKeywords: current?.relatedKeywords ?? normalized.relatedKeywords,
          relatedQuestions: current?.relatedQuestions ?? normalized.relatedQuestions,
          namedEntities: normalized.namedEntities,
        }));
        setEntitiesError(null);
        return normalized.namedEntities;
      }
    } catch {
      // Fall through to fetch.
    }

    const semanticResult =
      semanticData?.semanticResult ?? (await ensureSemanticData());

    if (!semanticResult) {
      return null;
    }

    setIsLoadingNamedEntities(true);
    setEntitiesError(null);
    setEntityLoadingStage('Fetching competitor SERP content from DataForSEO…');

    try {
      setEntityLoadingStage('Running Gemini named entity recognition…');
      const result = await fetchNamedEntities(
        session.url,
        session.keyword,
        session.locationCode
      );

      if (result.error && !result.data) {
        setEntitiesError(result.error);
        return null;
      }

      if (result.data) {
        const payload: SemanticAnalysisCacheData = {
          semanticResult,
          relatedKeywords: semanticData?.relatedKeywords ?? null,
          relatedQuestions: semanticData?.relatedQuestions ?? null,
          namedEntities: result.data,
        };

        setSemanticData(payload);
        persistSemanticCache(payload);
      }

      if (result.error) {
        setEntitiesError(result.error);
      }

      return result.data;
    } catch {
      setEntitiesError('Failed to load named entities. Please try again.');
      return null;
    } finally {
      setIsLoadingNamedEntities(false);
      setEntityLoadingStage(null);
    }
  }, [ensureSemanticData, persistSemanticCache, semanticData, session]);

  const value = useMemo<AnalysisContextValue>(
    () => ({
      session,
      technicalData,
      semanticData,
      auditReportData,
      isRunningTechnical,
      isLoadingSemantic,
      isLoadingNamedEntities,
      technicalError,
      semanticError,
      entitiesError,
      entityLoadingStage,
      setSession,
      setAuditReportData,
      runTechnicalAnalysis,
      ensureSemanticData,
      ensureNamedEntities,
      resetAnalysis,
      matchesSession,
      importCachedSession,
    }),
    [
      auditReportData,
      ensureNamedEntities,
      ensureSemanticData,
      entitiesError,
      entityLoadingStage,
      importCachedSession,
      isLoadingNamedEntities,
      isLoadingSemantic,
      isRunningTechnical,
      matchesSession,
      resetAnalysis,
      runTechnicalAnalysis,
      semanticData,
      semanticError,
      session,
      setSession,
      technicalData,
      technicalError,
    ]
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);

  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }

  return context;
}

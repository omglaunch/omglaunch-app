'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRelatedKeywords, fetchRelatedQuestions } from '@/app/actions/semantic-analysis';
import AnalysisLocationSelect from '@/components/analysis/AnalysisLocationSelect';
import { useProject } from '@/components/projects/ProjectProvider';
import { useAnalysis } from '@/components/analysis/AnalysisProvider';
import AnalysisCacheControls from '@/components/analysis/AnalysisCacheControls';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';
import { readSearchParamsFromWindow } from '@/lib/analysis-cache';
import { DEFAULT_SEMANTIC_LOCATION_CODE } from '@/lib/analysis-state';
import {
  buildSemanticIdentifier,
  persistAnalysisToHistory,
} from '@/lib/tool-history/analysis-persistence';
import { fetchToolHistoryEntry } from '@/lib/tool-history/client';
import {
  normalizeSemanticCacheData,
  type RelatedKeyword,
  type RelatedQuestion,
  type SemanticAnalysisCacheData,
} from '@/lib/semantic-metrics';
import SemanticAnalysis, { type SemanticTabId } from './SemanticAnalysis';

const INTERROGATIVE_WORD_REGEX =
  /^(how|what|why|when|where|who|which|is|are|can|do|does|will|should)\b/i;

function toRelatedQuestion(keyword: RelatedKeyword): RelatedQuestion {
  const match = keyword.expression.match(INTERROGATIVE_WORD_REGEX);
  const interrogativeWord = match
    ? match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase()
    : 'Other';

  return {
    expression: keyword.expression,
    searchVolume: keyword.searchVolume,
    interrogativeWord,
  };
}

function parseLocationFromIdentifier(identifier: string, fallback: number): number {
  const parts = identifier.split('::');
  const last = parts[parts.length - 1];
  const parsed = Number(last);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readInitialSemanticState() {
  const { url, keyword } = readSearchParamsFromWindow();

  return {
    url,
    keyword,
    timestamp: null as number | null,
    locationCode: DEFAULT_SEMANTIC_LOCATION_CODE,
    semanticData: null as SemanticAnalysisCacheData | null,
  };
}

export default function SemanticAnalysisClient() {
  const { activeProjectId } = useProject();
  const initialHydrationRef = useRef(readInitialSemanticState());
  const initial = initialHydrationRef.current;
  const didHydrateProvider = useRef(false);
  const isLoadedFromHistoryRef = useRef(false);
  const shouldPersistToHistoryRef = useRef(false);
  const historySessionIdRef = useRef<string | null>(null);
  const sessionPayloadRef = useRef<SemanticAnalysisCacheData | null>(initial.semanticData);

  const {
    entries: historyEntries,
    isLoading: isHistoryLoading,
    activeId,
    setActiveId,
    remove: removeHistoryEntry,
    refresh: refreshHistory,
  } = useToolHistory('semantic-analysis', {
    importLocal: true,
    limit: 25,
    workspaceId: activeProjectId,
  });

  const {
    session,
    technicalData,
    semanticData,
    isRunningTechnical,
    isLoadingSemantic,
    isLoadingNamedEntities,
    technicalError,
    semanticError,
    entitiesError,
    entityLoadingStage,
    runTechnicalAnalysis,
    ensureSemanticData,
    ensureNamedEntities,
    importCachedSession,
  } = useAnalysis();

  const [url, setUrl] = useState(initial.url);
  const [targetKeyword, setTargetKeyword] = useState(initial.keyword);
  const [selectedLocation, setSelectedLocation] = useState(initial.locationCode);
  const [activeTab, setActiveTab] = useState<SemanticTabId>('suggestions');
  const [formError, setFormError] = useState<string | null>(null);
  const [relatedKeywords, setRelatedKeywords] = useState<RelatedKeyword[] | null>(
    () => initial.semanticData?.relatedKeywords ?? null
  );
  const [relatedQuestions, setRelatedQuestions] = useState<RelatedQuestion[] | null>(
    () => initial.semanticData?.relatedQuestions ?? null
  );
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(() => initial.timestamp);
  const [isFromCache, setIsFromCache] = useState(() => initial.semanticData !== null);
  const [activeIdentifier, setActiveIdentifier] = useState<string | null>(null);

  const dedupedHistoryEntries = useMemo(() => {
    const seen = new Set<string>();

    return historyEntries.filter(entry => {
      if (seen.has(entry.identifier)) {
        return false;
      }

      seen.add(entry.identifier);
      return true;
    });
  }, [historyEntries]);

  const semanticResult = semanticData?.semanticResult ?? null;
  const namedEntities = semanticData?.namedEntities ?? null;
  const analysisLocationCode = session?.locationCode ?? selectedLocation;
  const displayKeyword = semanticResult?.targetKeyword ?? targetKeyword;
  const hasStartedAnalysis = Boolean(session || technicalData || isRunningTechnical);

  useEffect(() => {
    if (didHydrateProvider.current || !initial.url || !initial.keyword) {
      return;
    }

    didHydrateProvider.current = true;
    importCachedSession(
      {
        url: initial.url,
        keyword: initial.keyword,
        locationCode: initial.locationCode,
      },
      { semanticData: initial.semanticData }
    );
  }, [importCachedSession, initial]);

  const persistCache = useCallback(
    async (
      payload: SemanticAnalysisCacheData,
      cacheUrl: string,
      cacheKeyword: string,
      locationCode: number
    ) => {
      if (!shouldPersistToHistoryRef.current) {
        sessionPayloadRef.current = payload;
        return;
      }

      sessionPayloadRef.current = payload;
      const identifier = buildSemanticIdentifier(cacheUrl, cacheKeyword, locationCode);
      const historyId = await persistAnalysisToHistory({
        tool: 'semantic-analysis',
        identifier,
        data: payload,
        url: cacheUrl,
        keyword: cacheKeyword,
        workspaceId: activeProjectId,
        id: historySessionIdRef.current ?? undefined,
      });
      historySessionIdRef.current = historyId;
      setActiveIdentifier(identifier);
      setActiveId(historyId);
      setCachedAt(Date.now());
      await refreshHistory();
    },
    [activeProjectId, refreshHistory, setActiveId]
  );

  useEffect(() => {
    setRelatedKeywords(null);
    setRelatedQuestions(null);
    setFormError(null);
    setKeywordsError(null);
    setQuestionsError(null);
    setCachedAt(null);
    setIsFromCache(false);
    setActiveIdentifier(null);
    isLoadedFromHistoryRef.current = false;
    shouldPersistToHistoryRef.current = false;
    historySessionIdRef.current = null;
    sessionPayloadRef.current = null;
    setActiveId(null);
  }, [activeProjectId, setActiveId]);

  const runAnalysis = useCallback(
    async (targetUrl: string, keyword: string, locationCode: number) => {
      const trimmedUrl = targetUrl.trim();
      const trimmedKeyword = keyword.trim();

      if (!trimmedUrl || !trimmedKeyword) {
        return;
      }

      setFormError(null);
      setRelatedKeywords(null);
      setRelatedQuestions(null);
      setKeywordsError(null);
      setQuestionsError(null);
      setCachedAt(null);
      setIsFromCache(false);
      isLoadedFromHistoryRef.current = false;
      shouldPersistToHistoryRef.current = true;
      historySessionIdRef.current = null;

      const cacheKey = buildSemanticIdentifier(trimmedUrl, trimmedKeyword, locationCode);
      setActiveIdentifier(cacheKey);

      await runTechnicalAnalysis(trimmedUrl, trimmedKeyword, locationCode);
    },
    [runTechnicalAnalysis]
  );

  const loadRelatedKeywords = useCallback(async () => {
    const keyword = semanticResult?.targetKeyword ?? targetKeyword.trim();
    if (!keyword || relatedKeywords !== null) {
      return;
    }

    if (sessionPayloadRef.current) {
      const normalized = normalizeSemanticCacheData(sessionPayloadRef.current);

      if (normalized?.relatedKeywords && normalized.relatedKeywords.length > 0) {
        setRelatedKeywords(normalized.relatedKeywords);
        setKeywordsError(null);
        return;
      }
    }

    setIsLoadingKeywords(true);
    setKeywordsError(null);

    try {
      const pageUrl = session?.url ?? url.trim();
      const result = await fetchRelatedKeywords(keyword, analysisLocationCode, pageUrl);
      setRelatedKeywords(result.keywords);

      if (result.error) {
        setKeywordsError(result.error);
      }

      if (semanticResult && activeIdentifier) {
        const normalized = sessionPayloadRef.current
          ? normalizeSemanticCacheData(sessionPayloadRef.current)
          : null;
        const payload: SemanticAnalysisCacheData = {
          semanticResult,
          relatedKeywords: result.keywords,
          relatedQuestions: normalized?.relatedQuestions ?? null,
          namedEntities: normalized?.namedEntities ?? null,
        };

        void persistCache(
          payload,
          semanticResult.url,
          semanticResult.targetKeyword,
          analysisLocationCode
        );
      }
    } catch {
      setKeywordsError('Failed to load related keywords. Please try again.');
      setRelatedKeywords([]);
    } finally {
      setIsLoadingKeywords(false);
    }
  }, [
    activeIdentifier,
    analysisLocationCode,
    persistCache,
    relatedKeywords,
    semanticResult,
    session?.url,
    targetKeyword,
    url,
  ]);

  const loadRelatedQuestions = useCallback(async () => {
    const keyword = semanticResult?.targetKeyword ?? targetKeyword.trim();
    if (!keyword || relatedQuestions !== null) {
      return;
    }

    if (sessionPayloadRef.current) {
      const normalized = normalizeSemanticCacheData(sessionPayloadRef.current);

      if (normalized?.relatedQuestions && normalized.relatedQuestions.length > 0) {
        setRelatedQuestions(normalized.relatedQuestions);
        setQuestionsError(null);
        return;
      }
    }

    setIsLoadingQuestions(true);
    setQuestionsError(null);

    try {
      const result = await fetchRelatedQuestions(keyword, analysisLocationCode);
      setRelatedQuestions(result.questions.map(toRelatedQuestion));

      if (result.error) {
        setQuestionsError(result.error);
      }

      if (semanticResult && activeIdentifier) {
        const normalized = sessionPayloadRef.current
          ? normalizeSemanticCacheData(sessionPayloadRef.current)
          : null;
        const payload: SemanticAnalysisCacheData = {
          semanticResult,
          relatedKeywords: normalized?.relatedKeywords ?? null,
          relatedQuestions: result.questions.map(toRelatedQuestion),
          namedEntities: normalized?.namedEntities ?? null,
        };

        void persistCache(
          payload,
          semanticResult.url,
          semanticResult.targetKeyword,
          analysisLocationCode
        );
      }
    } catch {
      setQuestionsError('Failed to load related questions. Please try again.');
      setRelatedQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [
    activeIdentifier,
    analysisLocationCode,
    persistCache,
    relatedQuestions,
    semanticResult,
    targetKeyword,
  ]);

  useEffect(() => {
    if (activeTab !== 'suggestions') {
      return;
    }

    void ensureSemanticData();
  }, [activeTab, ensureSemanticData]);

  useEffect(() => {
    if (activeTab !== 'entities') {
      return;
    }

    void ensureNamedEntities();
  }, [activeTab, ensureNamedEntities]);

  useEffect(() => {
    if (activeTab !== 'keywords') {
      return;
    }

    void loadRelatedKeywords();
  }, [activeTab, loadRelatedKeywords]);

  useEffect(() => {
    if (activeTab !== 'questions') {
      return;
    }

    void loadRelatedQuestions();
  }, [activeTab, loadRelatedQuestions]);

  const handleTabChange = useCallback((tab: SemanticTabId) => {
    setActiveTab(tab);
  }, []);

  const handleForceRefresh = useCallback(() => {
    if (!url.trim() || !targetKeyword.trim()) return;

    setRelatedKeywords(null);
    setRelatedQuestions(null);
    setCachedAt(null);
    setIsFromCache(false);
    setActiveIdentifier(null);
    setActiveId(null);
    setFormError(null);
    setKeywordsError(null);
    setQuestionsError(null);
    historySessionIdRef.current = null;
    sessionPayloadRef.current = null;
    isLoadedFromHistoryRef.current = false;
    shouldPersistToHistoryRef.current = true;

    void runAnalysis(url, targetKeyword, selectedLocation);
  }, [runAnalysis, selectedLocation, setActiveId, targetKeyword, url]);

  useEffect(() => {
    if (!semanticData || !session?.url || !session.keyword) {
      return;
    }

    const payload = normalizeSemanticCacheData(semanticData);
    if (!payload) {
      return;
    }

    const previous = sessionPayloadRef.current
      ? normalizeSemanticCacheData(sessionPayloadRef.current)
      : null;

    const merged: SemanticAnalysisCacheData = {
      semanticResult: payload.semanticResult,
      namedEntities: payload.namedEntities ?? previous?.namedEntities ?? null,
      relatedKeywords: previous?.relatedKeywords ?? payload.relatedKeywords ?? null,
      relatedQuestions: previous?.relatedQuestions ?? payload.relatedQuestions ?? null,
    };

    sessionPayloadRef.current = merged;

    if (isLoadedFromHistoryRef.current) {
      isLoadedFromHistoryRef.current = false;
      return;
    }

    void persistCache(merged, session.url, session.keyword, session.locationCode);
  }, [persistCache, semanticData, session?.keyword, session?.locationCode, session?.url]);

  const handleLoadHistory = useCallback(
    async (entryId: string) => {
      const entry = await fetchToolHistoryEntry('semantic-analysis', entryId, activeProjectId);
      const payload = entry.resultData;

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('data' in payload) ||
        !normalizeSemanticCacheData((payload as { data: unknown }).data)
      ) {
        return;
      }

      const stored = payload as unknown as {
        data: SemanticAnalysisCacheData;
        keyword?: string;
        timestamp?: number;
      };
      const normalized = normalizeSemanticCacheData(stored.data);
      if (!normalized) {
        return;
      }

      isLoadedFromHistoryRef.current = true;
      shouldPersistToHistoryRef.current = false;
      historySessionIdRef.current = entry.id;
      sessionPayloadRef.current = normalized;
      setRelatedKeywords(normalized.relatedKeywords);
      setRelatedQuestions(normalized.relatedQuestions);
      setCachedAt(stored.timestamp ?? Date.parse(entry.createdAt));
      setIsFromCache(true);
      setActiveIdentifier(entry.identifier);
      setActiveId(entry.id);

      const locationCode = parseLocationFromIdentifier(entry.identifier, selectedLocation);
      setSelectedLocation(locationCode);
      setUrl(stored.data.semanticResult?.url ?? url);
      setTargetKeyword(stored.keyword ?? targetKeyword);

      await importCachedSession(
        {
          url: stored.data.semanticResult?.url ?? url,
          keyword: stored.keyword ?? targetKeyword,
          locationCode,
        },
        { semanticData: normalized }
      );
    },
    [activeProjectId, importCachedSession, selectedLocation, setActiveId, targetKeyword, url]
  );

  const combinedError = formError ?? technicalError;

  return (
    <div className="grid w-full min-w-0 max-w-full gap-8 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="min-w-0 space-y-8">
      <div className="min-w-0 max-w-full">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Start with a fast structural audit, then load semantic suggestions and named entities on
          demand when you open each tab.
        </p>

        <form
          className="mt-5 flex w-full min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap"
          onSubmit={event => {
            event.preventDefault();

            if (!url.trim()) {
              setFormError('Please enter a URL to analyze.');
              return;
            }
            if (!targetKeyword.trim()) {
              setFormError('Please enter a target keyword for semantic analysis.');
              return;
            }

            void runAnalysis(url, targetKeyword, selectedLocation);
          }}
        >
          <input
            type="url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="https://example.com/page"
            disabled={isRunningTechnical}
            className="min-w-0 w-full flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:focus:border-blue-400 dark:focus:ring-blue-100"
          />
          <input
            type="text"
            value={targetKeyword}
            onChange={event => setTargetKeyword(event.target.value)}
            placeholder="Target Keyword"
            disabled={isRunningTechnical}
            className="w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:focus:border-blue-400 dark:focus:ring-blue-100 sm:max-w-xs sm:flex-1"
          />
          <AnalysisLocationSelect
            value={selectedLocation}
            onChange={setSelectedLocation}
            disabled={isRunningTechnical}
            className="w-full min-w-0 sm:w-auto"
          />
          <button
            type="submit"
            disabled={isRunningTechnical}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {isRunningTechnical ? <Loader2 size={15} className="animate-spin" /> : null}
            Analyze
          </button>
        </form>
        {combinedError ? <p className="mt-2 text-sm text-red-600">{combinedError}</p> : null}
        {technicalData ? (
          <p className="mt-2 text-sm text-emerald-700">
            Technical audit complete — AI readiness score {technicalData.overallScore}%.
          </p>
        ) : null}
      </div>

      {isRunningTechnical ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-24 text-muted-foreground shadow-sm">
          <Loader2 size={28} className="animate-spin text-emerald-600 dark:text-blue-600" />
          <p className="text-sm">Running structural and technical audit…</p>
        </div>
      ) : null}

      {displayKeyword && hasStartedAnalysis && !isRunningTechnical ? (
        <SemanticAnalysis
          targetKeyword={displayKeyword}
          semanticResult={semanticResult}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isLoading={isLoadingSemantic}
          isLoadingSemantic={isLoadingSemantic}
          semanticError={semanticError}
          relatedKeywords={relatedKeywords}
          isLoadingKeywords={isLoadingKeywords}
          keywordsError={keywordsError}
          relatedQuestions={relatedQuestions}
          isLoadingQuestions={isLoadingQuestions}
          questionsError={questionsError}
          namedEntities={namedEntities}
          targetUrl={url}
          isLoadingEntities={isLoadingNamedEntities}
          entitiesError={entitiesError}
          entityLoadingStage={entityLoadingStage}
          cacheControls={
            semanticResult ? (
              <AnalysisCacheControls
                cachedAt={cachedAt}
                isFromCache={isFromCache}
                onForceRefresh={handleForceRefresh}
                isRefreshing={isRunningTechnical || isLoadingSemantic}
              />
            ) : null
          }
        />
      ) : null}
      </div>

      <div className="min-w-0 max-w-full">
        <ToolHistoryPanel
          title="Recent Semantic Analyses"
          entries={dedupedHistoryEntries}
          activeId={activeId}
          isLoading={isHistoryLoading}
          onLoad={entry => void handleLoadHistory(entry.id)}
          onDelete={id => void removeHistoryEntry(id)}
        />
      </div>
    </div>
  );
}

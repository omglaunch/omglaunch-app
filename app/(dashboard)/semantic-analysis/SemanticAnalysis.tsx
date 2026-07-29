'use client';

import type { ReactNode } from 'react';
import {
  HelpCircle,
  Loader2,
  Microscope,
  Network,
  Wand2,
} from 'lucide-react';
import type {
  NamedEntitiesResult,
  RelatedKeyword,
  RelatedQuestion,
  SemanticAnalysisResult,
} from '@/lib/semantic-metrics';
import { cn } from '@/lib/utils';
import NamedEntitiesTab from './NamedEntitiesTab';
import RelatedKeywordsTab from './RelatedKeywordsTab';
import RelatedQuestionsTab from './RelatedQuestionsTab';
import SemanticSuggestions from './SemanticSuggestions';

export type SemanticTabId =
  | 'suggestions'
  | 'keywords'
  | 'questions'
  | 'entities';

type SemanticAnalysisProps = {
  targetKeyword: string;
  semanticResult: SemanticAnalysisResult | null;
  activeTab: SemanticTabId;
  onTabChange: (tab: SemanticTabId) => void;
  isLoading?: boolean;
  isLoadingSemantic?: boolean;
  semanticError?: string | null;
  relatedKeywords?: RelatedKeyword[] | null;
  isLoadingKeywords?: boolean;
  keywordsError?: string | null;
  relatedQuestions?: RelatedQuestion[] | null;
  isLoadingQuestions?: boolean;
  questionsError?: string | null;
  namedEntities?: NamedEntitiesResult | null;
  targetUrl?: string;
  isLoadingEntities?: boolean;
  entitiesError?: string | null;
  entityLoadingStage?: string | null;
  cacheControls?: ReactNode;
};

const TABS: Array<{
  id: SemanticTabId;
  label: string;
  icon: typeof Wand2;
}> = [
  { id: 'suggestions', label: 'Semantic suggestions', icon: Wand2 },
  { id: 'keywords', label: 'Related keywords', icon: Network },
  { id: 'questions', label: 'Related questions', icon: HelpCircle },
  { id: 'entities', label: 'Named Entities', icon: Microscope },
];

export default function SemanticAnalysis({
  targetKeyword,
  semanticResult,
  activeTab,
  onTabChange,
  isLoading = false,
  isLoadingSemantic = false,
  semanticError = null,
  relatedKeywords = null,
  isLoadingKeywords = false,
  keywordsError = null,
  relatedQuestions = null,
  isLoadingQuestions = false,
  questionsError = null,
  namedEntities = null,
  targetUrl = '',
  isLoadingEntities = false,
  entitiesError = null,
  entityLoadingStage = null,
  cacheControls,
}: SemanticAnalysisProps) {
  return (
    <section className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="min-w-0 text-2xl font-bold text-foreground">
            Semantic analysis for &apos;{targetKeyword}&apos;
          </h1>
          {cacheControls}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Here are the different semantic analyses launched from your target keyword: semantic
          suggestions, related keyword search, related questions, named entities.
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div
          role="tablist"
          aria-label="Semantic analysis views"
          className="flex min-w-0 flex-wrap border-b border-border bg-card"
        >
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 dark:border-blue-600 dark:bg-blue-50/50 dark:text-blue-700'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    isActive ? 'text-emerald-600 dark:text-blue-600' : 'text-muted-foreground'
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 overflow-x-auto p-5">
          {isLoading && !semanticResult && activeTab === 'suggestions' ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-blue-600" aria-hidden />
              <p className="text-sm">Loading semantic suggestions…</p>
            </div>
          ) : (
            <>
              {activeTab === 'suggestions' ? (
                semanticResult ? (
                  <SemanticSuggestions
                    criteria={semanticResult.criteria}
                    totalWords={semanticResult.totalWords}
                    semanticScore={semanticResult.semanticScore}
                    isLoading={isLoadingSemantic}
                    semanticError={semanticError}
                  />
                ) : isLoadingSemantic ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-blue-600" aria-hidden />
                    <p className="text-sm">Loading semantic suggestions…</p>
                  </div>
                ) : semanticError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {semanticError}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/60 px-4 py-10 text-center text-sm text-muted-foreground">
                    Semantic suggestions will load when you open this tab.
                  </div>
                )
              ) : null}

              {activeTab === 'keywords' ? (
                <RelatedKeywordsTab
                  data={relatedKeywords}
                  isLoading={isLoadingKeywords}
                  error={keywordsError}
                />
              ) : null}

              {activeTab === 'questions' ? (
                <RelatedQuestionsTab
                  data={relatedQuestions}
                  targetKeyword={targetKeyword}
                  isLoading={isLoadingQuestions}
                  error={questionsError}
                />
              ) : null}

              {activeTab === 'entities' ? (
                <NamedEntitiesTab
                  data={namedEntities}
                  targetUrl={targetUrl}
                  targetKeyword={targetKeyword}
                  isLoading={isLoadingEntities}
                  loadingStage={entityLoadingStage}
                  error={entitiesError}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

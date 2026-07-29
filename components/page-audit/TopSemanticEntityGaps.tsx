'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useAnalysis } from '@/components/analysis/AnalysisProvider';
import { DEFAULT_SEMANTIC_LOCATION_CODE, getTopSemanticGaps } from '@/lib/analysis-state';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TopSemanticEntityGapsProps = {
  url: string;
  keyword: string;
  locationCode?: number;
};

export default function TopSemanticEntityGaps({
  url,
  keyword,
  locationCode = DEFAULT_SEMANTIC_LOCATION_CODE,
}: TopSemanticEntityGapsProps) {
  const {
    semanticData,
    matchesSession,
    ensureSemanticData,
    isLoadingSemantic,
    semanticError,
    setSession,
  } = useAnalysis();
  const [isTriggering, setIsTriggering] = useState(false);

  const sessionMatches = matchesSession(url, keyword);
  const semanticResult = sessionMatches ? semanticData?.semanticResult ?? null : null;
  const gaps = getTopSemanticGaps(semanticResult);
  const isLoading = isLoadingSemantic || isTriggering;

  const handleAnalyzeSemanticDepth = async () => {
    setIsTriggering(true);
    setSession(url, keyword, locationCode);
    try {
      await ensureSemanticData();
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Top Semantic Entity Gaps</h2>
          <p className="text-sm text-muted-foreground">
            High-interest expressions that are absent or overused on your page
          </p>
        </div>
      </div>

      {!semanticResult ? (
        <Card className="border-dashed border-border bg-muted/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Semantic depth not loaded yet</CardTitle>
            <CardDescription>
              Run semantic analysis to surface missing high-interest expressions from competitive
              benchmarks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={handleAnalyzeSemanticDepth}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Analyze Semantic Depth
            </Button>
            {semanticError ? (
              <p className="mt-3 text-sm text-red-600">{semanticError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : gaps.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gaps.map((criterion, index) => (
            <Card key={`${criterion.expression}-${index}`} className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"
                    aria-hidden
                  />
                  <div>
                    <CardTitle className="text-base">{criterion.expression}</CardTitle>
                    <CardDescription className="mt-1">
                      Interest {criterion.interestScore} · Used {criterion.occurrence.current}x
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {criterion.context || 'No context snippet available.'}
                </p>
                <p
                  className={cn(
                    'mt-2 text-xs font-medium',
                    criterion.occurrence.current === 0 ? 'text-red-600' : 'text-amber-700'
                  )}
                >
                  {criterion.occurrence.current === 0
                    ? 'Missing from page content'
                    : 'Present but outside healthy usage range'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardContent className="py-6">
            <p className="text-sm text-emerald-900">
              No major semantic gaps detected — your page covers the top high-interest expressions
              well.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

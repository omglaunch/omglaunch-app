'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { KeywordFrequency } from '@/lib/seo-analysis-data';
import { cn } from '@/lib/utils';

type SummaryVisualsProps = {
  resolvedKeyword?: string;
  keywordFrequencies: KeywordFrequency[];
  onRescan: () => void;
  isScanning?: boolean;
};

const BANNER_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'your',
  'our',
  'their',
  'my',
  'his',
  'her',
  'its',
  'into',
  'about',
  'over',
  'after',
  'before',
  'between',
  'through',
  'during',
  'without',
  'within',
  'along',
  'while',
  'best',
  'top',
  'new',
  'get',
  'guide',
  'complete',
]);

function tokenizeKeyword(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0 && !BANNER_STOP_WORDS.has(word));
}

function isKeywordImportant(
  resolvedKeyword: string,
  keywordFrequencies: KeywordFrequency[]
): boolean {
  const frequencyTerms = new Set(
    keywordFrequencies.map(entry => entry.text.toLowerCase())
  );

  const normalizedPhrase = resolvedKeyword.toLowerCase().trim();
  if (normalizedPhrase && frequencyTerms.has(normalizedPhrase)) {
    return true;
  }

  const keywordTokens = tokenizeKeyword(resolvedKeyword);
  return keywordTokens.some(token => frequencyTerms.has(token));
}

const PIE_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#0d9488',
  '#f97316',
  '#0891b2',
  '#4f46e5',
  '#059669',
  '#ea580c',
  '#0284c7',
  '#9333ea',
  '#16a34a',
  '#6366f1',
  '#14b8a6',
  '#e11d48',
  '#ca8a04',
  '#64748b',
];

function pieColorForEntry(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}

function valueToWordCloudClass(value: number, min: number, max: number): string {
  if (max === min) {
    return 'text-lg font-semibold text-emerald-800 dark:text-blue-800';
  }

  const ratio = (value - min) / (max - min);

  if (ratio >= 0.85) {
    return 'text-3xl font-bold text-emerald-900 dark:text-blue-900 sm:text-4xl';
  }
  if (ratio >= 0.65) {
    return 'text-2xl font-bold text-emerald-800 dark:text-blue-800 sm:text-3xl';
  }
  if (ratio >= 0.45) {
    return 'text-xl font-semibold text-emerald-700 dark:text-blue-700 sm:text-2xl';
  }
  if (ratio >= 0.25) {
    return 'text-lg font-medium text-slate-700';
  }
  if (ratio >= 0.1) {
    return 'text-base font-medium text-muted-foreground';
  }
  return 'text-sm text-muted-foreground';
}

function renderPieLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  name?: string;
  percent?: number;
}) {
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, name = '', percent = 0 } = props;

  if (percent < 0.04) {
    return null;
  }

  const radius = outerRadius + 14;
  const angleRad = (-midAngle * Math.PI) / 180;
  const x = cx + radius * Math.cos(angleRad);
  const y = cy + radius * Math.sin(angleRad);

  return (
    <text
      x={x}
      y={y}
      fill="#64748b"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-[10px] sm:text-[11px]"
    >
      {name}
    </text>
  );
}

function useCompactChart() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setCompact(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return compact;
}

export default function SummaryVisuals({
  resolvedKeyword,
  keywordFrequencies,
  onRescan,
  isScanning = false,
}: SummaryVisualsProps) {
  const compactChart = useCompactChart();
  const pieData = keywordFrequencies.map(entry => ({
    name: entry.text,
    value: entry.value,
  }));

  const wordCloudItems = keywordFrequencies;
  const wordCloudValues = wordCloudItems.map(entry => entry.value);
  const minValue = wordCloudValues.length > 0 ? Math.min(...wordCloudValues) : 0;
  const maxValue = wordCloudValues.length > 0 ? Math.max(...wordCloudValues) : 0;

  const trimmedKeyword = resolvedKeyword?.trim() ?? '';
  const hasKeyword = trimmedKeyword.length > 0 && trimmedKeyword !== 'unknown';
  const isKeywordAmongFrequentTerms =
    hasKeyword && isKeywordImportant(trimmedKeyword, keywordFrequencies);

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={onRescan}
          disabled={isScanning}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700 sm:w-auto"
        >
          {isScanning ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Scan the page again
        </button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        {!hasKeyword ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted px-3 py-3 sm:px-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm leading-relaxed text-slate-700">
              No target keyword could be determined. Enter a keyword in the analysis
              form to validate whether it appears among the page&apos;s most frequent terms.
            </p>
          </div>
        ) : isKeywordAmongFrequentTerms ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 sm:px-4">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-sm leading-relaxed text-emerald-900">
              A keyword close to{' '}
              <span className="font-semibold italic">{trimmedKeyword}</span> is among the
              important keywords on the page.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 sm:px-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm leading-relaxed text-amber-900">
              The target keyword{' '}
              <span className="font-semibold italic">{trimmedKeyword}</span> does not appear
              to be among the most frequent terms on this page. Consider adding it to your
              content.
            </p>
          </div>
        )}

        <div className="mt-6 grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              The page is optimized for the following expressions:
            </h2>
            <div className="mt-4 flex min-h-[180px] flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 px-1 py-4 sm:min-h-[220px] sm:gap-x-4 sm:gap-y-3 sm:px-2">
              {wordCloudItems.length > 0 ? (
                wordCloudItems.map(item => (
                  <span
                    key={item.text}
                    className={cn(
                      'inline-block max-w-full break-words leading-tight',
                      valueToWordCloudClass(item.value, minValue, maxValue)
                    )}
                  >
                    {item.text}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No keyword data available for this page.</p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Share of Top 15 Key Terms:
            </h2>
            <div className="mt-2 w-full min-w-0 overflow-hidden">
              {pieData.length > 0 ? (
                <>
                  <div className="h-[260px] w-full sm:h-[320px] lg:h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Tooltip
                          formatter={(value: number, _name, item) => [
                            `${value} occurrences`,
                            item.payload.name,
                          ]}
                          contentStyle={{
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.875rem',
                          }}
                        />
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={compactChart ? '58%' : '62%'}
                          stroke="none"
                          labelLine={
                            compactChart
                              ? false
                              : {
                                  stroke: '#94a3b8',
                                  strokeWidth: 1,
                                }
                          }
                          label={compactChart ? false : renderPieLabel}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={pieColorForEntry(index)}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {compactChart ? (
                    <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-3">
                      {pieData.map((entry, index) => (
                        <li key={entry.name} className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: pieColorForEntry(index) }}
                            aria-hidden
                          />
                          <span className="truncate">{entry.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <div className="flex h-[260px] w-full items-center justify-center text-sm text-muted-foreground sm:h-[350px]">
                  No term frequency data available.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
          <p>
            See the full list of{' '}
            <button type="button" className="text-emerald-600 hover:underline dark:text-blue-600">
              keywords
            </button>{' '}
            detected in the page.
          </p>
          <p>Check that the expressions found correspond to your SEO objectives.</p>
        </div>
      </div>
    </section>
  );
}

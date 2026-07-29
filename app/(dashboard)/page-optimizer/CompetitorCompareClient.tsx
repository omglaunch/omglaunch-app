'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Lightbulb,
  ListChecks,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSettingsBundle } from '@/app/actions/settings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { createKeywordAuditBrief } from '@/app/actions/content-pipeline';
import { useProject } from '@/components/projects/ProjectProvider';
import { useReportBranding } from '@/hooks/useReportBranding';
import { formatReportBrandingLines } from '@/lib/projects/client-brand-shared';
import { consumeRevenueRescuePrefill } from '@/lib/revenue-rescue/deep-links';
import ScoreRing from '@/components/competitor-compare/ScoreRing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';
import type { ComparePageMetrics, CompetitorCompareResult, ScrapeMethod, SemanticMarketGapRow, TrustSignals } from '@/lib/competitor-compare-data';
import {
  formatCompetitorCoverage,
  formatCompetitorCoveragePercent,
} from '@/lib/competitor-compare-data';
import { type SavedCompetitorAudit } from '@/lib/competitor-audit-history';
import { fetchToolHistoryEntry } from '@/lib/tool-history/client';
import { getDataForSeoLabsLocationNotice } from '@/app/(dashboard)/research/research-locations';
import {
  buildGeoContextLabel,
  getMetricsGeoAbbreviation,
  KEYWORD_AUDIT_COUNTRIES,
  KEYWORD_AUDIT_DEVICES,
  KEYWORD_AUDIT_LANGUAGES,
  resolveLocationCode,
  type KeywordAuditGeoInput,
} from '@/lib/keyword-audit/geo';
import {
  geoFromProjectLocationCode,
  hasGeoHintsInText,
  inferGeoFromKeywordOrUrl,
} from '@/lib/keyword-audit/infer-geo';
import { createScrapeErrorMetrics } from '@/lib/competitor-scrape-errors';
import {
  buildCompetitorCompareBriefTitle,
  formatCompetitorCompareBrief,
} from '@/lib/competitor-compare-brief';
import {
  formatKeywordDifficultyBadge,
  formatMobilePageSpeed,
  formatPageReferringDomains,
  formatReadabilityGrade,
  formatSchemaTypes,
  formatSearchVolumeBadge,
} from '@/lib/competitor-compare-metrics';
import { cn } from '@/lib/utils';
import ExportMarketReportButton from './ExportMarketReportButton';
import {
  PO_COMPARISON_PROGRESS_TRACK,
  PO_SEMANTIC_GAP_ENTITY_CELL,
  PO_SEMANTIC_GAP_ENTITY_HEAD,
  PO_STRATEGY_CODE_PILL_BASE,
  PO_STRATEGY_STEPS,
  PO_TABLE_HEADER_ROW,
  PO_TABLE_WRAPPER,
  PO_TECHNICAL_METRIC_CELL,
  PO_TECHNICAL_METRIC_HEAD,
  poBodyClass,
  poCardClass,
  poHeadingClass,
  poLinkClass,
  poMutedClass,
  poSubheadingClass,
} from './page-optimizer-theme';
import './competitor-audit-print.css';

const COMPETITOR_TABLE_OUTER = 'min-w-0 w-full max-w-full';
const COMPETITOR_SCROLL_TABLE = 'competitor-scroll-table w-max min-w-full border-collapse';
const COMPETITOR_DATA_COL = 'min-w-[120px] whitespace-nowrap px-4 text-center';
const TECHNICAL_COMPARISON_TABLE =
  'technical-comparison-scroll-table w-max min-w-full border-collapse md:w-full md:min-w-[900px] md:table-fixed';
const TECHNICAL_DATA_COL =
  'min-w-[140px] px-3 text-left align-top md:min-w-[160px] md:whitespace-normal md:break-words';
const COMPETITOR_URL_CELL =
  'max-w-[140px] truncate whitespace-nowrap text-xs md:max-w-none md:whitespace-normal md:break-all md:text-sm';
const SEMANTIC_GAPS_TABLE =
  'semantic-gaps-scroll-table w-max min-w-full border-collapse md:w-full md:min-w-[860px] md:table-fixed';
const SEMANTIC_GAP_ICON_COL =
  'w-[72px] min-w-[72px] max-w-[72px] px-2 text-center align-middle';
const SEMANTIC_GAP_COVERAGE_COL =
  'min-w-[180px] px-4 text-center align-middle md:min-w-[200px]';

const DEFAULT_GEO: KeywordAuditGeoInput = {
  country: 'Malaysia',
  city: '',
  language: 'en',
  device: 'desktop',
};

function normalizeGeoFromSettings(
  workspace: {
    defaultCountry?: string | null;
    defaultState?: string | null;
    defaultLanguage?: string | null;
    defaultDevice?: string | null;
  } | null,
  projectLocationCode?: number | null
): KeywordAuditGeoInput {
  const fromProject = geoFromProjectLocationCode(projectLocationCode);

  return {
    country: fromProject.country || workspace?.defaultCountry?.trim() || DEFAULT_GEO.country,
    city: fromProject.city || workspace?.defaultState?.trim() || '',
    language: workspace?.defaultLanguage?.trim().toLowerCase() || DEFAULT_GEO.language,
    device:
      workspace?.defaultDevice?.trim().toLowerCase() === 'mobile'
        ? 'mobile'
        : DEFAULT_GEO.device,
  };
}

function CompetitorTableScrollHint() {
  return (
    <div className="mb-2 flex w-full justify-end pr-1 md:hidden">
      <span className={cn('flex items-center gap-1 text-xs font-medium', poMutedClass)}>
        Swipe to compare
        <ArrowRight size={14} aria-hidden />
      </span>
    </div>
  );
}

function safeCompetitors(result: CompetitorCompareResult | null | undefined): ComparePageMetrics[] {
  return result?.competitors ?? [];
}

function isPageDataUnavailable(page: ComparePageMetrics | undefined): boolean {
  if (!page) {
    return true;
  }

  return Boolean(page.scrapeError || page.analysisFailed);
}

function isGeoScoreUnavailable(page: ComparePageMetrics | undefined): boolean {
  if (!page) {
    return true;
  }

  if (page.scrapeError || page.analysisFailed) {
    return true;
  }

  if (page.geoScore === null || page.geoScore === undefined) {
    return true;
  }

  if (page.geoScore === 0 && (page.scrapeError || page.analysisFailed)) {
    return true;
  }

  return false;
}

function alignCompetitorSlots(
  competitors: ComparePageMetrics[],
  competitorUrls: string[]
): ComparePageMetrics[] {
  if (competitorUrls.length === 0) {
    return competitors;
  }

  return competitorUrls.map((url, index) => {
    const candidate = competitors[index];
    if (candidate && candidate.url?.trim() && !isInvalidCompetitorSlot(candidate)) {
      return {
        ...candidate,
        label: `Comp ${index + 1}`,
        geoScore: candidate.geoScore ?? null,
      };
    }

    return createScrapeErrorMetrics(url, index, candidate?.geoScoreError ?? 'Failed to scrape');
  });
}

function isInvalidCompetitorSlot(page: ComparePageMetrics): boolean {
  if (page.scrapeError || page.analysisFailed) {
    return false;
  }

  return !page.url?.trim() || Object.keys(page).length === 0;
}

function resolveCompetitorUrls(
  activeUrls: string[],
  competitors: ComparePageMetrics[]
): string[] {
  if (activeUrls.length > 0) {
    return activeUrls;
  }

  return competitors.map(competitor => competitor.url).filter(Boolean);
}

/** Index 0 = target app; indices 1+ = competitors in submission order. */
function buildAllPagesData(
  yourPage: ComparePageMetrics | null | undefined,
  competitors: ComparePageMetrics[]
): ComparePageMetrics[] {
  if (!yourPage) {
    return [];
  }

  return [
    { ...yourPage, geoScore: yourPage.geoScore ?? null },
    ...competitors.map(competitor => ({
      ...competitor,
      geoScore: competitor.geoScore ?? null,
    })),
  ];
}

function mergeCompareResultIntoState(
  data: CompetitorCompareResult,
  competitorUrls: string[] = []
): {
  result: CompetitorCompareResult;
  competitorData: ComparePageMetrics[];
  allPagesData: ComparePageMetrics[];
} {
  const alignedCompetitors = alignCompetitorSlots(
    data.competitors ?? [],
    resolveCompetitorUrls(competitorUrls, data.competitors ?? [])
  );

  const competitorData = alignedCompetitors.map((competitor, index) => ({
    ...competitor,
    geoScore: alignedCompetitors[index]?.geoScore ?? null,
  }));

  const yourPage: ComparePageMetrics = {
    ...data.yourPage,
    geoScore: data.yourPage.geoScore ?? null,
  };

  const allPagesData = buildAllPagesData(yourPage, competitorData);

  return {
    result: {
      ...data,
      yourPage,
      competitors: competitorData,
    },
    competitorData,
    allPagesData,
  };
}

function getGeoScoreLabel(pageIndex: number): string {
  return pageIndex === 0 ? 'Your GEO Score' : `Comp ${pageIndex} GEO Score`;
}

function formatPageMetric(
  page: ComparePageMetrics | undefined,
  formatter: (page: ComparePageMetrics) => string | null | undefined
): string {
  if (!page || isPageDataUnavailable(page)) {
    return 'Data Unavailable';
  }

  const value = formatter(page);
  if (value == null || value === '') {
    return 'Data Unavailable';
  }

  return value;
}

function formatImagesMetric(page: ComparePageMetrics | undefined): string {
  if (!page || isPageDataUnavailable(page)) {
    return 'Failed to scrape';
  }

  return formatImagePresence(page.images);
}

function GeoScoreUnavailable({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <p className="text-2xl font-semibold tracking-wide text-zinc-400 dark:text-zinc-500">N/A</p>
      </div>
      <p className="max-w-[120px] text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </p>
    </div>
  );
}

function buildGeoScoreEntries(allPagesData: ComparePageMetrics[]) {
  return allPagesData.map((page, index) => ({
    id: `geo-${index}-${page?.url ?? 'missing'}`,
    label: getGeoScoreLabel(index),
    page,
    unavailable: isGeoScoreUnavailable(page),
    score: page?.geoScore ?? null,
  }));
}

function padCompetitorCovers(
  covers: boolean[] | undefined,
  competitorCount: number
): Array<boolean | undefined> {
  return Array.from({ length: competitorCount }, (_, index) => covers?.[index]);
}

function safeSemanticGaps(
  result: CompetitorCompareResult | null | undefined,
  competitorCount: number
): SemanticMarketGapRow[] {
  const totalCompetitors = competitorCount || result?.competitors?.length || 0;

  return (result?.semanticGaps ?? []).map(gap => {
    const covers = gap.competitorCovers ?? [];
    const competitorCovers = Array.from(
      { length: totalCompetitors },
      (_, index) => covers[index] ?? false
    );

    return {
      ...gap,
      competitorCovers,
      competitorCoverageCount: gap.competitorCoverageCount ?? competitorCovers.filter(Boolean).length,
      competitorCoverageTotal: gap.competitorCoverageTotal ?? totalCompetitors,
      competitorCoveragePercent:
        gap.competitorCoveragePercent ??
        (totalCompetitors > 0
          ? Math.round((competitorCovers.filter(Boolean).length / totalCompetitors) * 100)
          : 0),
    };
  });
}

function SemanticGapsTableSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-muted" />
      <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-muted/60" />
      <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-muted/60" />
      <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-muted/60" />
      <p className={cn('text-center text-sm', poSubheadingClass)}>Loading semantic gap analysis…</p>
    </div>
  );
}

function SemanticMarketGapsTable({
  gaps,
  allPagesData,
}: {
  gaps: SemanticMarketGapRow[];
  allPagesData: ComparePageMetrics[];
}) {
  const competitorPages = allPagesData.slice(1);

  if (gaps.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          No semantic market gaps detected — your page already covers the key topics competitors
          emphasize.
        </p>
      </div>
    );
  }

  return (
    <div className={COMPETITOR_TABLE_OUTER}>
      <CompetitorTableScrollHint />
      <div className={cn(PO_TABLE_WRAPPER, 'semantic-gaps-table md:whitespace-normal')}>
        <table className={cn('caption-bottom text-sm', SEMANTIC_GAPS_TABLE)}>
        <colgroup>
          <col style={{ width: '32%' }} />
          <col style={{ width: 72 }} />
          {competitorPages.map((comp, index) => (
            <col key={`col-comp-${index}-${comp.url}`} style={{ width: 72 }} />
          ))}
          <col />
        </colgroup>
        <TableHeader>
          <TableRow className={PO_TABLE_HEADER_ROW}>
            <TableHead className={PO_SEMANTIC_GAP_ENTITY_HEAD}>Keyword/Entity</TableHead>
            <TableHead className={SEMANTIC_GAP_ICON_COL}>Your Page</TableHead>
            {competitorPages.map((comp, index) => (
              <TableHead key={`comp-${index}-${comp.url}`} className={SEMANTIC_GAP_ICON_COL}>
                Comp {index + 1}
              </TableHead>
            ))}
            <TableHead className={SEMANTIC_GAP_COVERAGE_COL}>Competitor Coverage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gaps.map(gap => (
            <TableRow key={gap.entity} className="gap-row semantic-row">
              <TableCell className={PO_SEMANTIC_GAP_ENTITY_CELL}>
                <div className="min-w-0 pr-2">
                  <p className={cn('semantic-gap-entity-title break-words font-medium leading-snug', poHeadingClass)}>
                    {gap.entity}
                  </p>
                  <p className={cn('semantic-gap-entity-subtitle mt-1 break-words capitalize leading-snug', poSubheadingClass)}>
                    {gap.entityType}
                  </p>
                </div>
              </TableCell>
              <TableCell className={SEMANTIC_GAP_ICON_COL}>
                <GapStatusIcon covered="missing" />
              </TableCell>
              {competitorPages.map((comp, index) => {
                const covers = padCompetitorCovers(gap.competitorCovers, competitorPages.length)[index];

                if (isPageDataUnavailable(comp) || covers === undefined) {
                  return (
                    <TableCell key={`${gap.entity}-comp-${index}`} className={SEMANTIC_GAP_ICON_COL}>
                      <GapDataUnavailableIcon />
                    </TableCell>
                  );
                }

                return (
                  <TableCell key={`${gap.entity}-comp-${index}`} className={SEMANTIC_GAP_ICON_COL}>
                    <GapStatusIcon covered={covers} />
                  </TableCell>
                );
              })}
              <TableCell className={SEMANTIC_GAP_COVERAGE_COL}>
                <CompetitorCoverageCell gap={gap} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
      </div>
    </div>
  );
}

function GapDataUnavailableIcon() {
  return (
    <span
      className={cn(
        'icon-neutral inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/35 bg-muted/60 text-[10px] font-semibold uppercase tracking-tight text-muted-foreground'
      )}
      aria-label="Data unavailable"
      title="Data unavailable for this competitor"
    >
      N/A
    </span>
  );
}

function GapStatusIcon({ covered }: { covered: boolean | 'missing' }) {
  if (covered === 'missing') {
    return (
      <span
        className="icon-error inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
        aria-label="Missing from your page"
        title="Missing from your page"
      >
        <X className="pdf-icon-svg h-4 w-4" strokeWidth={3} />
        <span className="pdf-icon-fallback" aria-hidden>
          ✕
        </span>
      </span>
    );
  }

  if (covered) {
    return (
      <span
        className="icon-success inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        aria-label="Topic covered"
        title="Topic covered"
      >
        <Check className="pdf-icon-svg h-4 w-4" strokeWidth={3} />
        <span className="pdf-icon-fallback" aria-hidden>
          ✓
        </span>
      </span>
    );
  }

  return (
    <span
      className="icon-neutral inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-label="Topic not covered"
      title="Topic not covered"
    >
      <Minus className="pdf-icon-svg h-4 w-4" strokeWidth={3} />
      <span className="pdf-icon-fallback" aria-hidden>
        −
      </span>
    </span>
  );
}

function CompetitorCoverageCell({ gap }: { gap: SemanticMarketGapRow }) {
  const isFullCoverage = gap.competitorCoverageCount === gap.competitorCoverageTotal;

  return (
    <div className="flex flex-col items-center gap-1.5 whitespace-nowrap">
      <Badge
        variant="outline"
        className={cn(
          'whitespace-nowrap tabular-nums font-semibold',
          isFullCoverage
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
        )}
      >
        {formatCompetitorCoverage(gap)}
      </Badge>
      <span className={cn('whitespace-nowrap text-xs', poSubheadingClass)}>
        {formatCompetitorCoveragePercent(gap)}
      </span>
      <div className="h-1.5 w-full max-w-[100px] overflow-hidden rounded-full bg-gray-100 dark:bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isFullCoverage ? 'bg-indigo-500' : 'bg-amber-500'
          )}
          style={{ width: `${gap.competitorCoveragePercent}%` }}
        />
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STRATEGY_HEADING_TAG_PATTERN =
  /(<h[1-6]>|<\/h[1-6]>|&lt;h[1-6]&gt;|&lt;\/h[1-6]&gt;)/gi;

function isStrategyHeadingTag(part: string): boolean {
  return /^(?:<h[1-6]>|<\/h[1-6]>|&lt;h[1-6]&gt;|&lt;\/h[1-6]&gt;)$/i.test(part);
}

function normalizeHeadingTagDisplay(tag: string): string {
  return tag.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

/** Wrap literal HTML heading tags in styled, one-click-copyable code pills. */
function formatCodeTags(text: string, codeThemeClass: string): string {
  return text
    .split(STRATEGY_HEADING_TAG_PATTERN)
    .map(part => {
      if (!part) return '';
      if (isStrategyHeadingTag(part)) {
        return `<code class="${PO_STRATEGY_CODE_PILL_BASE} ${codeThemeClass}">${escapeHtml(
          normalizeHeadingTagDisplay(part)
        )}</code>`;
      }
      return escapeHtml(part);
    })
    .join('');
}

function StrategyPlanSection({ result }: { result: CompetitorCompareResult }) {
  const plan = result.strategyPlan;
  if (!plan) return null;

  const stepBodies = [
    plan.criticalGapFocus,
    plan.structuralRecommendation,
    plan.nextBestAction,
  ];
  const stepIcons = [Lightbulb, ListChecks, Sparkles];

  return (
    <Card className={cn('w-full max-w-full overflow-hidden', poCardClass)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg">AI Competitive Strategy Plan</CardTitle>
            <CardDescription className="break-words">
              A 3-step action plan to close market gaps and improve your GEO score.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-3">
        {PO_STRATEGY_STEPS.map((step, index) => {
          const Icon = stepIcons[index];
          const body = stepBodies[index] ?? '';
          return (
            <div
              key={step.title}
              className={cn(
                'strategy-box w-full max-w-full whitespace-normal break-words rounded-xl p-5 text-wrap',
                step.accent
              )}
            >
              <div className="mb-3 flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm',
                    step.iconBg
                  )}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <h3 className={cn('min-w-0 text-sm font-semibold', step.titleClass)}>{step.title}</h3>
              </div>
              <p
                className={cn('break-words', step.bodyClass)}
                dangerouslySetInnerHTML={{
                  __html: formatCodeTags(body, step.codePillClass),
                }}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function formatImagePresence(images: {
  total: number;
  missingAlt: number;
  backgroundImages?: number;
}): string {
  if (images.total === 0) return 'None';
  const withAlt = images.total - images.missingAlt;
  const bgNote =
    images.backgroundImages && images.backgroundImages > 0
      ? `, ${images.backgroundImages} bg`
      : '';
  return `${images.total} (${withAlt} w/ alt${bgNote})`;
}

function ScrapeMethodBadge({ method }: { method?: ScrapeMethod }) {
  if (!method) {
    return null;
  }

  const isCheerio = method === 'cheerio';

  return (
    <span
      className={cn(
        'mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight',
        isCheerio
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
          : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
      )}
      title={
        isCheerio
          ? 'Parsed from static HTML when live browser render was empty or unavailable.'
          : 'Captured from a headless browser after JavaScript execution.'
      }
    >
      {isCheerio ? 'HTML snapshot' : 'Live render'}
    </span>
  );
}

function TechnicalComparisonScrapeNote({
  allPagesData,
}: {
  allPagesData: ComparePageMetrics[];
}) {
  const cheerioPages = allPagesData.filter(page => page.scrapeMethod === 'cheerio');
  if (cheerioPages.length === 0) {
    return null;
  }

  const labels = cheerioPages.map(page =>
    page.label === 'Your App' || page.label === 'Your Page' ? 'your page' : page.label.toLowerCase()
  );

  return (
    <p className={cn('mb-4 text-xs leading-relaxed', poSubheadingClass)}>
      {labels.length === allPagesData.length
        ? 'All metrics below use an HTML snapshot (Cheerio fallback) because live browser rendering did not return readable content.'
        : `HTML snapshot used for ${labels.join(', ')} — static HTML parse when live browser render was empty or unavailable. Other columns used live headless browser rendering.`}
    </p>
  );
}

function formatTrustSignals(signals: TrustSignals | undefined | null): string {
  const { outboundLinks, quotes, statistics } = signals ?? {
    outboundLinks: 0,
    quotes: 0,
    statistics: 0,
  };
  return `${outboundLinks} Links, ${statistics} Stats, ${quotes} Quotes`;
}

const COMPARISON_PROGRESS_TRACK = PO_COMPARISON_PROGRESS_TRACK;

function ComparisonMetricProgress({
  valueLabel,
  fillPercentage,
  fillClassName,
  valueClassName,
}: {
  valueLabel: string;
  fillPercentage: number;
  fillClassName: string;
  valueClassName?: string;
}) {
  const clampedFill = Math.max(0, Math.min(100, fillPercentage));

  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-sm font-medium tabular-nums', poHeadingClass, valueClassName)}>
        {valueLabel}
      </span>
      <span className={COMPARISON_PROGRESS_TRACK} aria-hidden>
        <span
          className={cn('block h-full rounded-full transition-all', fillClassName)}
          style={{ width: `${clampedFill}%` }}
        />
      </span>
    </div>
  );
}

function getMobilePageSpeedFillClass(score: number): string {
  if (score >= 90) {
    return 'bg-emerald-500';
  }

  if (score >= 50) {
    return 'bg-amber-500';
  }

  return 'bg-red-500';
}

function WordCountCell({
  page,
  maxWordCount,
}: {
  page: ComparePageMetrics | undefined;
  maxWordCount: number;
}) {
  if (!page || isPageDataUnavailable(page)) {
    return <span className={cn('text-sm', poMutedClass)}>Data Unavailable</span>;
  }

  const fillPercentage = maxWordCount > 0 ? (page.wordCount / maxWordCount) * 100 : 0;

  return (
    <ComparisonMetricProgress
      valueLabel={page.wordCount.toLocaleString()}
      fillPercentage={fillPercentage}
      fillClassName="bg-blue-600"
    />
  );
}

function MobilePageSpeedCell({ page }: { page: ComparePageMetrics | undefined }) {
  if (!page || isPageDataUnavailable(page)) {
    return <span className={cn('text-sm', poMutedClass)}>Data Unavailable</span>;
  }

  const score = page.mobilePageSpeed;
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return <span className={cn('text-sm', poMutedClass)}>Data Unavailable</span>;
  }

  const rounded = Math.round(score);

  return (
    <ComparisonMetricProgress
      valueLabel={formatMobilePageSpeed(score)}
      fillPercentage={rounded}
      fillClassName={getMobilePageSpeedFillClass(rounded)}
    />
  );
}

function KeywordMetricBadge({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  className: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border px-2.5 py-1 text-xs font-semibold tabular-nums shadow-sm backdrop-blur-sm',
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="font-medium opacity-80">{label}</span>
      {value}
    </Badge>
  );
}

function ComparisonGrid({ allPagesData }: { allPagesData: ComparePageMetrics[] }) {
  if (allPagesData.length === 0) {
    return (
      <p className={cn('text-sm', poSubheadingClass)}>Technical comparison data is not available yet.</p>
    );
  }

  const competitorPages = allPagesData.slice(1);
  const maxWordCount = Math.max(
    ...allPagesData
      .filter(page => !isPageDataUnavailable(page))
      .map(page => page.wordCount ?? 0),
    1
  );

  const metricRows: Array<{
    metric: string;
    renderCell: (page: ComparePageMetrics | undefined) => ReactNode;
  }> = [
    {
      metric: 'Word Count',
      renderCell: page => <WordCountCell page={page} maxWordCount={maxWordCount} />,
    },
    {
      metric: 'Heading Count',
      renderCell: page => (
        <span className={cn('text-sm tabular-nums', poHeadingClass)}>
          {formatPageMetric(page, current => String(current.headingCount))}
        </span>
      ),
    },
    {
      metric: 'Images & Alt Text Presence',
      renderCell: page => (
        <span className={cn('text-sm', poHeadingClass)}>{formatImagesMetric(page)}</span>
      ),
    },
    {
      metric: 'Trust Signals (EEAT)',
      renderCell: page => (
        <span className={cn('text-sm', poHeadingClass)}>
          {formatPageMetric(page, current => formatTrustSignals(current.trustSignals))}
        </span>
      ),
    },
    {
      metric: 'Structured Data / Schema',
      renderCell: page => (
        <span className={cn('whitespace-normal break-words text-xs leading-snug md:text-sm', poHeadingClass)}>
          {formatPageMetric(page, current => formatSchemaTypes(current.schemaTypes))}
        </span>
      ),
    },
    {
      metric: 'Readability Score',
      renderCell: page => (
        <span className={cn('text-sm tabular-nums', poHeadingClass)}>
          {formatPageMetric(page, current => formatReadabilityGrade(current.readabilityGrade))}
        </span>
      ),
    },
    {
      metric: 'Page-Level Referring Domains',
      renderCell: page => (
        <span className={cn('text-sm tabular-nums', poHeadingClass)}>
          {formatPageMetric(page, current =>
            formatPageReferringDomains(current.pageReferringDomains)
          )}
        </span>
      ),
    },
    {
      metric: 'Mobile Page Speed',
      renderCell: page => <MobilePageSpeedCell page={page} />,
    },
  ];

  return (
    <div className={COMPETITOR_TABLE_OUTER}>
      <CompetitorTableScrollHint />
      <div className={cn(PO_TABLE_WRAPPER, 'technical-comparison-table md:whitespace-normal')}>
        <table className={cn('caption-bottom text-sm', TECHNICAL_COMPARISON_TABLE)}>
        <colgroup>
          <col style={{ width: '24%' }} />
          {allPagesData.map((page, index) => (
            <col key={`tech-col-${index}-${page.url}`} style={{ width: `${76 / allPagesData.length}%` }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className={PO_TABLE_HEADER_ROW}>
            <TableHead className={PO_TECHNICAL_METRIC_HEAD}>Metric</TableHead>
            <TableHead className={TECHNICAL_DATA_COL}>
              <span className="block">Your App</span>
              <ScrapeMethodBadge method={allPagesData[0]?.scrapeMethod} />
            </TableHead>
            {competitorPages.map((comp, index) => (
              <TableHead key={`comp-head-${index}-${comp.url}`} className={TECHNICAL_DATA_COL}>
                <span className="block">Comp {index + 1}</span>
                <ScrapeMethodBadge method={comp.scrapeMethod} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="technical-comparison-url-row">
            <TableCell className={cn(PO_TECHNICAL_METRIC_CELL, 'font-medium', poBodyClass)}>
              URL
            </TableCell>
            {allPagesData.map((page, index) => (
              <TableCell
                key={`url-${index}-${page.url}`}
                className={cn(
                  TECHNICAL_DATA_COL,
                  COMPETITOR_URL_CELL,
                  poLinkClass,
                  'technical-comparison-url-cell align-top'
                )}
                title={page.url}
              >
                {page.url}
              </TableCell>
            ))}
          </TableRow>
          {metricRows.map(row => (
            <TableRow key={row.metric}>
              <TableCell className={cn(PO_TECHNICAL_METRIC_CELL, 'font-medium', poBodyClass)}>
                {row.metric}
              </TableCell>
              {allPagesData.map((page, index) => (
                <TableCell key={`${row.metric}-${index}`} className={TECHNICAL_DATA_COL}>
                  {row.renderCell(page)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
      </div>
    </div>
  );
}

function isSavedCompetitorAudit(value: unknown): value is SavedCompetitorAudit {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const audit = value as SavedCompetitorAudit;
  return (
    typeof audit.targetKeyword === 'string' &&
    typeof audit.yourUrl === 'string' &&
    !!audit.result
  );
}

export default function CompetitorCompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId, activeProject } = useProject();
  const branding = useReportBranding();
  const brandLines = formatReportBrandingLines(branding);
  const [isPending, startTransition] = useTransition();
  const [targetKeyword, setTargetKeyword] = useState('');
  const [yourUrl, setYourUrl] = useState('');
  const [competitor1, setCompetitor1] = useState('');
  const [competitor2, setCompetitor2] = useState('');
  const [competitor3, setCompetitor3] = useState('');
  const [visibleCompetitors, setVisibleCompetitors] = useState(1);
  const [activeCompetitorUrls, setActiveCompetitorUrls] = useState<string[]>([]);
  const [geo, setGeo] = useState<KeywordAuditGeoInput>(DEFAULT_GEO);
  const [geoBase, setGeoBase] = useState<KeywordAuditGeoInput>(DEFAULT_GEO);
  const [isGeoLoading, setIsGeoLoading] = useState(true);
  const [geoManuallySet, setGeoManuallySet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompetitorCompareResult | null>(null);
  const [competitorData, setCompetitorData] = useState<ComparePageMetrics[]>([]);
  const [rescueContext, setRescueContext] = useState<string | null>(null);
  const rescueHydratedRef = useRef(false);
  const {
    entries: historyEntries,
    isLoading: isHistoryLoading,
    activeId: activeAuditId,
    setActiveId: setActiveAuditId,
    save: saveHistoryEntry,
    remove: removeHistoryEntry,
  } = useToolHistory('page-optimizer', {
    importLocal: true,
    limit: 25,
    workspaceId: activeProjectId,
  });

  useEffect(() => {
    setResult(null);
    setCompetitorData([]);
    setActiveCompetitorUrls([]);
    setError(null);
    setBriefError(null);
    setActiveAuditId(null);
    setRescueContext(null);
    rescueHydratedRef.current = false;
    setGeoManuallySet(false);
  }, [activeProjectId, setActiveAuditId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsGeoLoading(true);
      try {
        const settings = await getSettingsBundle();
        if (cancelled) {
          return;
        }

        const base = normalizeGeoFromSettings(settings.workspace, activeProject?.locationCode);
        setGeoBase(base);

        if (!geoManuallySet) {
          setGeo(inferGeoFromKeywordOrUrl(targetKeyword, yourUrl, base));
        }
      } catch {
        if (!cancelled) {
          const base = normalizeGeoFromSettings(null, activeProject?.locationCode);
          setGeoBase(base);
          if (!geoManuallySet) {
            setGeo(inferGeoFromKeywordOrUrl(targetKeyword, yourUrl, base));
          }
        }
      } finally {
        if (!cancelled) {
          setIsGeoLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject?.locationCode, activeProjectId]);

  useEffect(() => {
    if (geoManuallySet || isGeoLoading) {
      return;
    }

    setGeo(inferGeoFromKeywordOrUrl(targetKeyword, yourUrl, geoBase));
  }, [targetKeyword, yourUrl, geoBase, isGeoLoading, geoManuallySet]);

  useEffect(() => {
    if (rescueHydratedRef.current) return;

    const source = searchParams.get('source')?.trim() ?? '';
    const urlParam = searchParams.get('url')?.trim() ?? '';
    const keywordParam = searchParams.get('targetKeyword')?.trim() ?? '';
    const diagnosisParam = searchParams.get('diagnosis')?.trim() ?? '';
    const deltaParam = searchParams.get('metricDeltaPct')?.trim() ?? '';

    const prefill =
      source === 'revenue-rescue'
        ? consumeRevenueRescuePrefill()
        : null;

    const url = prefill?.url || urlParam;
    const keyword = prefill?.targetKeyword || keywordParam;
    const diagnosis = prefill?.diagnosis || diagnosisParam;
    const deltaPct =
      prefill?.metricDeltaPct ??
      (deltaParam ? Number(deltaParam) : null);

    if (!url && !keyword) return;

    rescueHydratedRef.current = true;
    if (url) setYourUrl(url);
    if (keyword) setTargetKeyword(keyword);
    if (diagnosis) {
      const deltaLabel =
        deltaPct != null && Number.isFinite(deltaPct)
          ? ` · ${deltaPct}% traffic`
          : '';
      setRescueContext(`${diagnosis}${deltaLabel}`);
      toast.success(`Prefilling from Revenue Rescue: ${diagnosis}`);
    }
  }, [searchParams]);

  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isSendingToStudio, setIsSendingToStudio] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  function saveAuditToHistory(input: {
    targetKeyword: string;
    yourUrl: string;
    competitorUrls: string[];
    result: CompetitorCompareResult;
  }) {
    const audit: SavedCompetitorAudit = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      targetKeyword: input.targetKeyword,
      yourUrl: input.yourUrl,
      competitorUrls: input.competitorUrls,
      result: input.result,
      projectId: activeProjectId,
    };

    void saveHistoryEntry({
      identifier: input.targetKeyword.trim() || input.yourUrl,
      workspaceId: activeProjectId,
      resultData: audit,
    });
  }

  function hydrateFromSavedAudit(audit: SavedCompetitorAudit) {
    const urls = audit.competitorUrls ?? [];

    setTargetKeyword(audit.targetKeyword);
    setYourUrl(audit.yourUrl);
    setCompetitor1(urls[0] ?? '');
    setCompetitor2(urls[1] ?? '');
    setCompetitor3(urls[2] ?? '');
    setVisibleCompetitors(Math.min(3, Math.max(1, urls.length || 1)));
    setActiveCompetitorUrls(urls);
    setResult(audit.result);
    if (audit.result.metricsGeo) {
      setGeoManuallySet(true);
      setGeo(audit.result.metricsGeo);
    }
    setCompetitorData(
      alignCompetitorSlots(audit.result.competitors ?? [], urls).map((competitor, index) => ({
        ...competitor,
        geoScore: audit.result.competitors[index]?.geoScore ?? competitor.geoScore ?? null,
      }))
    );
    setActiveAuditId(audit.id);
    setError(null);
  }

  async function handleLoadAudit(entryId: string) {
    const entry = await fetchToolHistoryEntry('page-optimizer', entryId, activeProjectId);
    if (!isSavedCompetitorAudit(entry.resultData)) {
      return;
    }

    hydrateFromSavedAudit(entry.resultData);
    setActiveAuditId(entry.id);
  }

  function handleDeleteAudit(id: string) {
    void removeHistoryEntry(id);
  }

  function handleAddCompetitor() {
    if (visibleCompetitors < 3) {
      setVisibleCompetitors(prev => prev + 1);
    }
  }

  function buildBriefFilename(keyword: string): string {
    const slug = keyword.trim().replace(/\s+/g, '-');
    return `${slug || 'content'}-seo-brief.md`;
  }

  async function handleGenerateBrief() {
    if (!result) {
      setBriefError('Run Page Optimizer first to generate a content brief.');
      return;
    }

    const keyword = result.targetKeyword.trim() || targetKeyword.trim();
    const url = result.yourPage?.url?.trim() || yourUrl.trim();

    if (!keyword) {
      setBriefError('Target keyword is required to generate a content brief.');
      return;
    }

    if (!url) {
      setBriefError('Target URL is required to generate a content brief.');
      return;
    }

    const briefCompetitors = alignCompetitorSlots(
      competitorData.length > 0 ? competitorData : safeCompetitors(result),
      resolveCompetitorUrls(activeCompetitorUrls, competitorData.length > 0 ? competitorData : safeCompetitors(result))
    );
    const briefSemanticGaps = safeSemanticGaps(result, briefCompetitors.length);

    setIsGeneratingBrief(true);
    setBriefError(null);

    try {
      const response = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKeyword: keyword,
          targetUrl: url,
          aiStrategyPlan: result.strategyPlan,
          semanticGaps: briefSemanticGaps,
          yourPage: result.yourPage,
          competitors: briefCompetitors,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Content brief generation failed. Please try again.';
        throw new Error(message);
      }

      const markdown =
        typeof payload === 'object' && payload !== null && 'markdown' in payload
          ? String(payload.markdown)
          : '';

      if (!markdown) {
        throw new Error('Content brief generation returned empty content.');
      }

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = buildBriefFilename(keyword);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (generateError) {
      setBriefError(
        generateError instanceof Error
          ? generateError.message
          : 'Content brief generation failed. Please try again.'
      );
    } finally {
      setIsGeneratingBrief(false);
    }
  }

  async function handleSendToArticleStudio() {
    if (!result) {
      toast.error('Run Page Optimizer first to send a brief to Article Studio.');
      return;
    }

    if (!activeProjectId.trim()) {
      toast.error('Select a project before sending to Article Studio.');
      return;
    }

    const keyword = result.targetKeyword.trim() || targetKeyword.trim();
    if (!keyword) {
      toast.error('Target keyword is required to send to Article Studio.');
      return;
    }

    setIsSendingToStudio(true);

    try {
      const briefTitle = buildCompetitorCompareBriefTitle(keyword);
      const briefContent = formatCompetitorCompareBrief(result);

      await createKeywordAuditBrief(keyword, briefTitle, briefContent, activeProjectId);

      const params = new URLSearchParams({
        targetKeyword: keyword,
        title: briefTitle,
      });

      router.push(`/article-studio?${params.toString()}`);
      toast.success('Competitive gap brief sent to Article Studio.');
    } catch (sendError) {
      toast.error(
        sendError instanceof Error
          ? sendError.message
          : 'Failed to send brief to Article Studio.'
      );
    } finally {
      setIsSendingToStudio(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedYourUrl = yourUrl.trim();
    const trimmedComp1 = competitor1.trim();

    if (!trimmedYourUrl || !trimmedComp1) {
      setError('Your URL and Competitor 1 URL are required.');
      return;
    }

    const competitorUrls = [competitor1, competitor2, competitor3]
      .map(url => url.trim())
      .filter(Boolean);

    if (competitorUrls.length === 0) {
      setError('At least one competitor URL is required.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetKeyword: targetKeyword.trim(),
            yourUrl: trimmedYourUrl,
            competitorUrls,
            workspaceId: activeProjectId,
            country: geo.country,
            city: geo.city,
            language: geo.language,
            device: geo.device,
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String(payload.error)
              : 'Analysis failed. Check your URLs and try again.';
          throw new Error(message);
        }

        const data = payload as CompetitorCompareResult;

        const merged = mergeCompareResultIntoState(data, competitorUrls);
        setActiveCompetitorUrls(competitorUrls);
        console.log(
          'Calculated Scores:',
          merged.allPagesData.map(page => ({
            url: page.url,
            geoScore: page.geoScore,
          }))
        );

        setResult(merged.result);
        setCompetitorData(merged.competitorData);
        saveAuditToHistory({
          targetKeyword: targetKeyword.trim(),
          yourUrl: trimmedYourUrl,
          competitorUrls,
          result: merged.result,
        });
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'Analysis failed. Check your URLs and try again.'
        );
      }
    });
  }

  const rawCompetitors = competitorData.length > 0 ? competitorData : safeCompetitors(result);
  const competitors = alignCompetitorSlots(
    rawCompetitors,
    resolveCompetitorUrls(activeCompetitorUrls, rawCompetitors)
  );
  const allPagesData = buildAllPagesData(result?.yourPage, competitors);
  const semanticGaps = safeSemanticGaps(result, competitors.length);
  const gapsDataReady = result == null || Array.isArray(result.semanticGaps);

  const geoScoreEntries = buildGeoScoreEntries(allPagesData);
  const searchVolumeLabel = formatSearchVolumeBadge(result?.searchVolume);
  const keywordDifficultyLabel = formatKeywordDifficultyBadge(result?.keywordDifficulty);
  const activeMetricsGeo = result?.metricsGeo ?? geo;
  const metricsGeoAbbrev = getMetricsGeoAbbreviation(activeMetricsGeo);
  const metricsGeoContext = buildGeoContextLabel(activeMetricsGeo);
  const labsLocationNotice = useMemo(
    () => getDataForSeoLabsLocationNotice(resolveLocationCode(geo.country, geo.city)),
    [geo.country, geo.city]
  );
  const showsDetectedMarketHint =
    !geoManuallySet && hasGeoHintsInText(targetKeyword, yourUrl) && !isGeoLoading;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Users className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className={cn('text-xl font-semibold', poHeadingClass)}>Page Optimizer</h1>
            <p className={cn('mt-0.5 text-sm', poSubheadingClass)}>
              Compare your page against up to three competitors for GEO scores, technical signals,
              and semantic market gaps — then optimize with actionable recommendations.
            </p>
            {rescueContext ? (
              <p className="mt-2 inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                From Revenue Rescue · {rescueContext}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
        <Card className={poCardClass}>
          <CardHeader>
            <CardTitle className="text-lg">Market Comparison Setup</CardTitle>
            <CardDescription>
              Enter your URL and competitor URLs to analyze market gaps for a target keyword.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="targetKeyword">Target Keyword</Label>
                <Input
                  id="targetKeyword"
                  type="text"
                  placeholder="e.g. best running shoes"
                  value={targetKeyword}
                  onChange={e => setTargetKeyword(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="yourUrl">
                  Your URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="yourUrl"
                  type="url"
                  placeholder="https://yoursite.com/page"
                  value={yourUrl}
                  onChange={e => setYourUrl(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="competitor1">
                  Competitor 1 URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="competitor1"
                  type="url"
                  placeholder="https://competitor-one.com/page"
                  value={competitor1}
                  onChange={e => setCompetitor1(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>

              {visibleCompetitors >= 2 && (
                <div className="space-y-2">
                  <Label htmlFor="competitor2">Competitor 2 URL</Label>
                  <Input
                    id="competitor2"
                    type="url"
                    placeholder="https://competitor-two.com/page"
                    value={competitor2}
                    onChange={e => setCompetitor2(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              )}

              {visibleCompetitors >= 3 && (
                <div className="space-y-2">
                  <Label htmlFor="competitor3">Competitor 3 URL</Label>
                  <Input
                    id="competitor3"
                    type="url"
                    placeholder="https://competitor-three.com/page"
                    value={competitor3}
                    onChange={e => setCompetitor3(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              )}

              {visibleCompetitors < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCompetitor}
                  disabled={isPending}
                  className="w-full border-dashed"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another competitor
                </Button>
              )}

              <Accordion type="single" collapsible className="rounded-lg border border-border px-3">
                <AccordionItem value="geo-settings" className="border-none">
                  <AccordionTrigger className="py-3 text-sm font-medium text-foreground hover:no-underline">
                    Search Market (Vol / KD)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-1">
                      <p className={cn('text-xs', poSubheadingClass)}>
                        Vol and KD are fetched from DataForSEO for the selected Google market — not
                        global.
                      </p>
                      {showsDetectedMarketHint ? (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          Detected {buildGeoContextLabel(inferGeoFromKeywordOrUrl(targetKeyword, yourUrl, geoBase))} from your keyword/URL.
                        </p>
                      ) : null}
                      {labsLocationNotice ? (
                        <p className={cn('text-xs', poMutedClass)}>{labsLocationNotice}</p>
                      ) : null}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="page-optimizer-country">Country</Label>
                          <Select
                            value={geo.country}
                            onValueChange={value => {
                              setGeoManuallySet(true);
                              setGeo(current => ({ ...current, country: value }));
                            }}
                            disabled={isPending || isGeoLoading}
                          >
                            <SelectTrigger id="page-optimizer-country">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {KEYWORD_AUDIT_COUNTRIES.map(country => (
                                <SelectItem key={country.code} value={country.label}>
                                  {country.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="page-optimizer-city">City / Region</Label>
                          <Input
                            id="page-optimizer-city"
                            placeholder="e.g., Kuala Lumpur (optional)"
                            value={geo.city ?? ''}
                            onChange={event => {
                              setGeoManuallySet(true);
                              setGeo(current => ({ ...current, city: event.target.value }));
                            }}
                            disabled={isPending || isGeoLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="page-optimizer-language">Language</Label>
                          <Select
                            value={geo.language}
                            onValueChange={value => {
                              setGeoManuallySet(true);
                              setGeo(current => ({ ...current, language: value }));
                            }}
                            disabled={isPending || isGeoLoading}
                          >
                            <SelectTrigger id="page-optimizer-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              {KEYWORD_AUDIT_LANGUAGES.map(language => (
                                <SelectItem key={language.value} value={language.value}>
                                  {language.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="page-optimizer-device">Device</Label>
                          <Select
                            value={geo.device}
                            onValueChange={value => {
                              setGeoManuallySet(true);
                              setGeo(current => ({ ...current, device: value }));
                            }}
                            disabled={isPending || isGeoLoading}
                          >
                            <SelectTrigger id="page-optimizer-device">
                              <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                              {KEYWORD_AUDIT_DEVICES.map(device => (
                                <SelectItem key={device.value} value={device.value}>
                                  {device.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={isPending || isGeoLoading}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing market…
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Analyze Market Gaps
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <ToolHistoryPanel
          title="Recent Optimizations"
          description="Saved to your workspace — load instantly without re-running analysis."
          entries={historyEntries}
          activeId={activeAuditId}
          isLoading={isHistoryLoading}
          onLoad={entry => void handleLoadAudit(entry.id)}
          onDelete={handleDeleteAudit}
        />
        </div>

        <div className="min-w-0 lg:col-span-3">
          {!result && !isPending && (
            <Card className="flex h-full min-h-[320px] items-center justify-center border-dashed border-border bg-muted/30 shadow-sm">
              <CardContent className="py-12 text-center">
                <ArrowLeftRight className={cn('mx-auto mb-4 h-10 w-10', poMutedClass)} />
                <p className={cn('text-sm font-medium', poBodyClass)}>No comparison yet</p>
                <p className={cn('mt-1 text-sm', poMutedClass)}>
                  Submit the form to generate GEO scores and semantic gap intelligence.
                </p>
              </CardContent>
            </Card>
          )}

          {isPending && (
            <Card className={cn('flex h-full min-h-[320px] items-center justify-center', poCardClass)}>
              <CardContent className="py-12 text-center">
                <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-500" />
                <p className={cn('text-sm font-medium', poBodyClass)}>Running page optimization…</p>
                <p className={cn('mt-1 text-sm', poMutedClass)}>
                  Scraping pages, scoring GEO readiness, and running AI topic modeling.
                </p>
              </CardContent>
            </Card>
          )}

          {result && !isPending && (
            <div
              ref={reportRef}
              id="competitor-audit-report"
              className="report-content competitor-audit-report w-full max-w-full space-y-6 overflow-x-hidden [&_*:not(.competitor-audit-table):not(.competitor-scroll-table)]:max-w-full"
            >
              <Card className={cn('w-full max-w-full overflow-hidden', poCardClass)}>
                <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-none">
                  <div className="executive-summary-header flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {brandLines.footerLeft}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Executive Summary
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {result.targetKeyword || 'Market comparison'}
                      </h2>
                      {result.targetKeyword?.trim() ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <KeywordMetricBadge
                              label={metricsGeoAbbrev ? `Vol · ${metricsGeoAbbrev}` : 'Vol'}
                              value={searchVolumeLabel ?? '—'}
                              icon={TrendingUp}
                              className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                            />
                            <KeywordMetricBadge
                              label={metricsGeoAbbrev ? `KD · ${metricsGeoAbbrev}` : 'KD'}
                              value={keywordDifficultyLabel ?? '—'}
                              icon={BarChart3}
                              className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                            />
                          </div>
                          {metricsGeoAbbrev ? (
                            <p className={cn('text-[11px]', poMutedClass)}>
                              Search metrics for {metricsGeoContext}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {result.yourPage?.url ? (
                        <a
                          href={result.yourPage.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'executive-summary-url mt-2 block min-w-0 max-w-full truncate text-sm hover:underline',
                            poLinkClass
                          )}
                          title={result.yourPage.url}
                        >
                          {result.yourPage.url}
                        </a>
                      ) : (
                        <p className={cn('mt-2 text-sm', poMutedClass)}>—</p>
                      )}
                    </div>
                    <div
                      className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end"
                      data-pdf-exclude
                    >
                      <ExportMarketReportButton result={result} reportRef={reportRef} />
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSendToArticleStudio}
                          disabled={isSendingToStudio || isPending}
                          className="border border-emerald-500/40 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                        >
                          {isSendingToStudio ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <PenLine className="mr-2 h-4 w-4" />
                          )}
                          Send to Article Studio
                        </Button>
                        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateBrief}
                            disabled={isGeneratingBrief || isPending}
                            className="border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                          >
                            {isGeneratingBrief ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-2 h-4 w-4" />
                            )}
                            Export AI Content Brief (.md)
                          </Button>
                          {briefError ? (
                            <p className="text-xs text-red-600 dark:text-red-400">{briefError}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {geoScoreEntries.length > 0 && (
                    <div
                      className={cn(
                        'executive-summary-scores mt-6 grid w-full gap-4',
                        geoScoreEntries.length === 1 && 'grid-cols-1 place-items-center',
                        geoScoreEntries.length === 2 && 'grid-cols-2',
                        geoScoreEntries.length === 3 && 'grid-cols-2 md:grid-cols-3',
                        geoScoreEntries.length >= 4 && 'grid-cols-2 md:grid-cols-4'
                      )}
                    >
                      {geoScoreEntries.map(entry => (
                        <div
                          key={entry.id}
                          className="flex w-full min-w-0 justify-center rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/50"
                        >
                          {entry.unavailable || entry.score === null ? (
                            <GeoScoreUnavailable label={entry.label} />
                          ) : (
                            <ScoreRing
                              score={entry.score}
                              label={entry.label}
                              size="sm"
                              variant="onDark"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <CardContent className="min-w-0 pt-6">
                  <h3 className={cn('mb-2 text-sm font-semibold uppercase tracking-wide', poSubheadingClass)}>
                    Technical Comparison
                  </h3>
                  <TechnicalComparisonScrapeNote allPagesData={allPagesData} />
                  <ComparisonGrid allPagesData={allPagesData} />
                </CardContent>
              </Card>

              <Card className={cn('w-full max-w-full overflow-hidden', poCardClass)}>
                <CardHeader className="flex min-w-0 flex-row items-start justify-between gap-4 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">Semantic Market Gaps</CardTitle>
                    <CardDescription className="break-words">
                      High-intent product categories and commercial themes competitors cover that
                      are completely missing from your page.
                    </CardDescription>
                  </div>
                  <ExportMarketReportButton
                    result={result}
                    reportRef={reportRef}
                    className="shrink-0"
                  />
                </CardHeader>
                <CardContent className="min-w-0">
                  {!gapsDataReady ? (
                    <SemanticGapsTableSkeleton />
                  ) : (
                    <SemanticMarketGapsTable gaps={semanticGaps} allPagesData={allPagesData} />
                  )}
                </CardContent>
              </Card>

              <StrategyPlanSection result={result} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

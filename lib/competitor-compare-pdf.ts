import { format } from 'date-fns';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { CompetitorCompareResult, SemanticMarketGapRow } from '@/lib/competitor-compare-data';
import {
  formatReportBrandingLines,
  type ReportBranding,
} from '@/lib/projects/client-brand-shared';

const COLORS = {
  primary: '#2563eb',
  slate900: '#111827',
  slate700: '#374151',
  slate500: '#6b7280',
  slate100: '#f3f4f6',
  emerald: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
} as const;

/** A4 width (595.28pt) minus left/right page margins (40pt each) */
const CONTENT_WIDTH = 515;

const TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#e5e7eb',
  vLineColor: () => '#e5e7eb',
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

type PdfMakeInstance = Awaited<ReturnType<typeof loadPdfMake>>;

let pdfMakePromise: Promise<PdfMakeInstance> | null = null;

async function loadPdfMake() {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;

  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;

  const vfs =
    pdfFonts?.pdfMake?.vfs ||
    pdfFonts?.vfs ||
    (typeof window !== 'undefined' && (window as any).pdfMake?.vfs);

  pdfMake.vfs = vfs;

  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };

  return pdfMake;
}

function getPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = loadPdfMake();
  }
  return pdfMakePromise;
}

function scoreColor(score: number): string {
  if (score >= 80) return COLORS.emerald;
  if (score >= 60) return COLORS.amber;
  return COLORS.red;
}

/** Short labels for narrow PDF columns — prevents right-edge clipping. */
function formatImageSummaryPdf(images: { total: number; missingAlt: number }): string {
  if (images.total === 0) return 'None';
  const withAlt = images.total - images.missingAlt;
  return `${images.total} imgs\n${withAlt} w/ alt`;
}

function formatCompetitorCoveragePdf(gap: SemanticMarketGapRow): string {
  return `${gap.competitorCoverageCount}/${gap.competitorCoverageTotal} comps\n${gap.competitorCoveragePercent}%`;
}

/**
 * Build numeric column widths that sum exactly to CONTENT_WIDTH.
 * Prevents pdfmake from clipping the right edge when rounding errors accumulate.
 */
function buildExactTableWidths(fixedWidths: number[]): number[] {
  const fixedTotal = fixedWidths.reduce((sum, width) => sum + width, 0);
  if (fixedTotal >= CONTENT_WIDTH) {
    const scale = CONTENT_WIDTH / fixedTotal;
    return fixedWidths.map(width => Math.floor(width * scale));
  }

  const widths = [...fixedWidths];
  let sum = widths.reduce((total, width) => total + width, 0);
  let index = widths.length - 1;

  while (sum < CONTENT_WIDTH && index >= 0) {
    widths[index] += 1;
    sum += 1;
    index -= 1;
  }

  while (sum > CONTENT_WIDTH && index >= 0) {
    if (widths[index] > 1) {
      widths[index] -= 1;
      sum -= 1;
    }
    index -= 1;
  }

  return widths;
}

/** Label column + N data columns for Your App + 1–3 competitors. */
function buildComparisonTableWidths(dataColumnCount: number): (string | number)[] {
  const labelWidth = 118;
  const remaining = CONTENT_WIDTH - labelWidth;
  const dataWidth = Math.floor(remaining / Math.max(dataColumnCount, 1));
  const fixed = [labelWidth, ...Array(dataColumnCount).fill(dataWidth)];
  return buildExactTableWidths(fixed);
}

/** Entity flex + status icons + coverage column for gaps table. */
function buildGapsTableWidths(competitorCount: number): (string | number)[] {
  const statusWidth = 30;
  const coverageWidth = 72;
  const fixedCount = 1 + competitorCount + 1;
  const fixedTotal = statusWidth * (fixedCount - 1) + coverageWidth;
  const entityWidth = Math.max(100, CONTENT_WIDTH - fixedTotal);

  return [
    entityWidth,
    ...Array(competitorCount + 1).fill(statusWidth),
    coverageWidth,
  ];
}

function gapStatusSymbol(covered: boolean | 'missing'): { text: string; color: string } {
  if (covered === 'missing') return { text: '✗', color: COLORS.red };
  if (covered) return { text: '✓', color: COLORS.emerald };
  return { text: '—', color: COLORS.slate500 };
}

function buildCoveragePill(gap: SemanticMarketGapRow): Content {
  return {
    unbreakable: true,
    text: formatCompetitorCoveragePdf(gap),
    alignment: 'center',
    fontSize: 7,
    lineHeight: 1.2,
    color: COLORS.primary,
    margin: [0, 1, 0, 1],
  };
}

function buildScoreSection(result: CompetitorCompareResult): Content {
  const competitors = result.competitors ?? [];
  const allPages = result.yourPage ? [result.yourPage, ...competitors] : competitors;

  if (allPages.length === 0) {
    return { text: 'No score data available.', style: 'body' };
  }

  const widths = buildExactTableWidths(
    Array(allPages.length).fill(Math.floor(CONTENT_WIDTH / allPages.length))
  );

  const scoreCells = allPages.map(page => ({
    text: page.geoScore !== null ? `${page.geoScore}` : '—',
    alignment: 'center' as const,
    color: page.geoScore !== null ? scoreColor(page.geoScore) : COLORS.slate500,
    bold: true,
    fontSize: 13,
  }));

  const labelCells = allPages.map(page => ({
    text: page.label,
    alignment: 'center' as const,
    fontSize: 8,
    color: COLORS.slate500,
    lineHeight: 1.2,
  }));

  return {
    margin: [0, 0, 0, 16],
    table: {
      widths,
      body: [scoreCells, labelCells],
    },
    layout: 'noBorders',
  };
}

function buildComparisonGrid(result: CompetitorCompareResult): Content {
  const competitors = result.competitors ?? [];
  const allPages = result.yourPage ? [result.yourPage, ...competitors] : competitors;
  const widths = buildComparisonTableWidths(allPages.length);

  const headerRow = [
    { text: 'Metric', style: 'tableHeader', fillColor: COLORS.slate100 },
    ...allPages.map(page => ({
      text: page.label,
      style: 'tableHeaderCompact',
      fillColor: COLORS.slate100,
      alignment: 'center' as const,
    })),
  ];

  const rows = [
    ['Word Count', ...allPages.map(p => p.wordCount.toLocaleString())],
    ['Headings', ...allPages.map(p => String(p.headingCount))],
    ['Images/Alt', ...allPages.map(p => formatImageSummaryPdf(p.images))],
  ];

  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        headerRow,
        ...rows.map(row =>
          row.map((cell, index) => ({
            text: cell,
            style: index === 0 ? 'tableMetric' : 'tableValueCompact',
            lineHeight: index === 0 ? 1.2 : 1.15,
          }))
        ),
      ],
    },
    layout: TABLE_LAYOUT,
    margin: [0, 0, 0, 20],
  };
}

function buildGapsTable(result: CompetitorCompareResult): Content {
  const gaps = result.semanticGaps ?? [];
  const competitors = result.competitors ?? [];

  if (gaps.length === 0) {
    return {
      text: 'No semantic market gaps detected — your page covers key competitor topics.',
      style: 'body',
      margin: [0, 8, 0, 0],
    };
  }

  const widths = buildGapsTableWidths(competitors.length);

  const header = [
    'Keyword/Entity',
    'You',
    ...competitors.map((_, index) => `C${index + 1}`),
    'Coverage',
  ];

  const body = [
    header.map(text => ({
      text,
      style: 'tableHeaderCompact',
      fillColor: COLORS.slate100,
      alignment: text === 'Keyword/Entity' ? ('left' as const) : ('center' as const),
    })),
    ...gaps.slice(0, 10).map(gap => {
      const covers = gap.competitorCovers ?? [];
      return [
        {
          text: `${gap.entity}\n(${gap.entityType})`,
          style: 'tableMetricWrap',
        },
        {
          ...gapStatusSymbol('missing'),
          alignment: 'center' as const,
          fontSize: 11,
          bold: true,
        },
        ...competitors.map((_, index) => ({
          ...gapStatusSymbol(covers[index] ?? false),
          alignment: 'center' as const,
          fontSize: 11,
          bold: true,
        })),
        buildCoveragePill(gap),
      ];
    }),
  ];

  return {
    table: {
      headerRows: 1,
      widths,
      body,
    },
    layout: TABLE_LAYOUT,
  };
}

function buildStrategyBlock(title: string, body: string): Content {
  return {
    unbreakable: true,
    stack: [
      { text: title, style: 'planLabel', margin: [0, 0, 0, 4] },
      { text: body, style: 'bodyWrap', margin: [0, 0, 0, 10] },
    ],
    margin: [0, 0, 0, 4],
  };
}

function buildStrategySection(result: CompetitorCompareResult): Content {
  const plan = result.strategyPlan;
  if (!plan) {
    return { text: '' };
  }

  return {
    stack: [
      { text: 'AI Competitive Strategy Plan', style: 'sectionTitle' },
      buildStrategyBlock('Critical Gap Focus', plan.criticalGapFocus),
      buildStrategyBlock('Structural Recommendation', plan.structuralRecommendation),
      buildStrategyBlock('Next Best Action', plan.nextBestAction),
    ],
    margin: [0, 8, 0, 0],
  };
}

function buildDocument(
  result: CompetitorCompareResult,
  branding?: ReportBranding
): TDocumentDefinitions {
  const brandLines = formatReportBrandingLines(branding);

  return {
    info: {
      title: `Market Report — ${result.targetKeyword || 'competitor audit'}`,
      author: brandLines.author,
      subject: brandLines.footerLeft,
    },
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: COLORS.slate700,
    },
    footer: () => ({
      text: brandLines.footerLeft,
      alignment: 'center',
      fontSize: 8,
      color: COLORS.slate500,
      margin: [40, 0, 40, 24],
    }),
    styles: {
      coverTitle: { fontSize: 22, bold: true, color: COLORS.slate900 },
      coverBrand: { fontSize: 16, bold: true, color: COLORS.slate900 },
      coverEyebrow: {
        fontSize: 10,
        bold: true,
        color: COLORS.primary,
        characterSpacing: 1.5,
      },
      sectionTitle: { fontSize: 14, bold: true, color: COLORS.slate900, margin: [0, 16, 0, 8] },
      planLabel: { fontSize: 11, bold: true, color: COLORS.violet },
      body: { fontSize: 10, lineHeight: 1.4 },
      bodyWrap: { fontSize: 10, lineHeight: 1.35 },
      tableHeader: { fontSize: 9, bold: true, color: COLORS.slate700 },
      tableHeaderCompact: { fontSize: 7.5, bold: true, color: COLORS.slate700 },
      tableMetric: { fontSize: 9, color: COLORS.slate700 },
      tableMetricWrap: { fontSize: 8, color: COLORS.slate700, lineHeight: 1.2 },
      tableValue: { fontSize: 9, alignment: 'center' },
      tableValueCompact: { fontSize: 7.5, alignment: 'center', lineHeight: 1.15 },
    },
    content: [
      { text: 'MULTI-COMPETITOR GEO AUDIT', style: 'coverEyebrow' },
      { text: 'Market Intelligence Report', style: 'coverTitle', margin: [0, 8, 0, 4] },
      {
        text: result.targetKeyword || '(no keyword specified)',
        fontSize: 12,
        color: COLORS.slate500,
        margin: [0, 0, 0, 4],
      },
      {
        text: result.yourPage?.url ?? '',
        fontSize: 9,
        color: COLORS.slate500,
        margin: [0, 0, 0, 4],
      },
      {
        text: format(new Date(result.analyzedAt), 'MMMM d, yyyy · h:mm a'),
        fontSize: 9,
        color: COLORS.slate500,
        margin: [0, 0, 0, 16],
      },
      { text: brandLines.coverBrand, style: 'coverBrand', margin: [0, 0, 0, 4] },
      branding?.agencyName
        ? {
            text: `Prepared by ${branding.agencyName}`,
            fontSize: 10,
            color: COLORS.slate500,
            margin: [0, 0, 0, 24],
          }
        : { text: '' },
      { text: 'GEO Scores', style: 'sectionTitle' },
      buildScoreSection(result),
      { text: 'Technical Comparison', style: 'sectionTitle' },
      buildComparisonGrid(result),
      { text: 'Semantic Market Gaps', style: 'sectionTitle' },
      buildGapsTable(result),
      buildStrategySection(result),
    ],
  };
}

export function buildCompetitorComparePdfFilename(keyword: string): string {
  const slug = (keyword || 'market-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `competitor-geo-audit-${slug || 'report'}.pdf`;
}

const PDF_GENERATION_TIMEOUT_MS = 60_000;

async function createPdfBlobWithTimeout(
  pdfMake: PdfMakeInstance,
  docDefinition: TDocumentDefinitions
): Promise<Blob> {
  const pdf = pdfMake.createPdf(docDefinition);

  const blobPromise = pdf.getBlob();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('PDF generation timed out after 60 seconds'));
    }, PDF_GENERATION_TIMEOUT_MS);
  });

  return Promise.race([blobPromise, timeoutPromise]);
}

export async function generateCompetitorComparePdfBlob(
  result: CompetitorCompareResult,
  branding?: ReportBranding
): Promise<Blob> {
  try {
    const pdfMake = await getPdfMake();
    const docDefinition = buildDocument(result, branding);
    const blob = await createPdfBlobWithTimeout(pdfMake, docDefinition);

    if (!blob || blob.size === 0) {
      throw new Error('PDF generation returned an empty blob');
    }

    return blob;
  } catch (error) {
    console.error('[competitor-compare-pdf] generateCompetitorComparePdfBlob failed:', error);
    throw error;
  }
}

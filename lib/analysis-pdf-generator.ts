import { format } from 'date-fns';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { AnalysisMetrics } from '@/lib/analysis-data';
import type { ReportBranding } from '@/lib/projects/client-brand-shared';
import { formatReportBrandingLines } from '@/lib/projects/client-brand-shared';

const COLORS = {
  primary: '#2563eb',
  indigo: '#3730a3',
  slate900: '#111827',
  slate700: '#374151',
  slate500: '#6b7280',
  slate100: '#f3f4f6',
  slate50: '#f9fafb',
  emerald: '#059669',
  amber: '#d97706',
  red: '#dc2626',
} as const;

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

function buildCoverPage(metrics: AnalysisMetrics, branding?: ReportBranding): Content {
  const brandLines = formatReportBrandingLines(branding);
  const scoreFill = scoreColor(metrics.overallScore);

  return {
    stack: [
      { text: ' ', margin: [0, 80, 0, 0] },
      {
        text: 'ANALYSIS AI REPORT',
        style: 'coverEyebrow',
        alignment: 'center',
      },
      {
        text: 'AI Readiness Assessment',
        style: 'coverTitle',
        alignment: 'center',
        margin: [40, 16, 40, 12],
      },
      {
        text: metrics.url,
        style: 'coverUrl',
        alignment: 'center',
        margin: [40, 0, 40, 40],
      },
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: `${metrics.overallScore.toFixed(1)}%`,
                    style: 'coverScore',
                    color: scoreFill,
                    alignment: 'center',
                  },
                  {
                    text: 'GEO SCORE',
                    style: 'coverScoreLabel',
                    alignment: 'center',
                    margin: [0, 4, 0, 0],
                  },
                ],
                fillColor: COLORS.slate50,
                margin: [24, 24, 24, 24],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [120, 0, 120, 48],
      },
      {
        text: format(new Date(), 'MMMM d, yyyy · h:mm a'),
        style: 'coverDate',
        alignment: 'center',
      },
      {
        text: brandLines.coverBrand,
        style: 'coverBrand',
        alignment: 'center',
        margin: [0, 48, 0, 0],
      },
      branding?.agencyName
        ? {
            text: `Prepared by ${branding.agencyName}`,
            style: 'coverDate',
            alignment: 'center',
            margin: [0, 8, 0, 0],
          }
        : { text: '' },
    ],
    pageBreak: 'after',
  };
}

function buildChecksTable(metrics: AnalysisMetrics): Content {
  const headerRow = [
    { text: '#', style: 'tableHeader', alignment: 'center' as const },
    { text: 'Check', style: 'tableHeader' },
    { text: 'Score', style: 'tableHeader', alignment: 'right' as const },
  ];

  const bodyRows = metrics.checks.map((check, index) => [
    {
      text: String(index + 1),
      style: 'tableCell',
      alignment: 'center' as const,
      color: COLORS.slate500,
    },
    { text: check.question, style: 'tableCell' },
    {
      text: `${check.score}%`,
      style: 'tableCellBold',
      alignment: 'right' as const,
      color: scoreColor(check.score),
    },
  ]);

  return {
    table: {
      headerRows: 1,
      widths: [28, '*', 52],
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => COLORS.slate100,
      vLineColor: () => COLORS.slate100,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 8,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.slate50 : null),
    },
  };
}

function buildDocumentDefinition(
  metrics: AnalysisMetrics,
  branding?: ReportBranding
): TDocumentDefinitions {
  const brandLines = formatReportBrandingLines(branding);
  const content: Content[] = [
    buildCoverPage(metrics, branding),
    { text: 'Executive Summary', style: 'sectionTitle', margin: [0, 0, 0, 4] },
    {
      text: 'AI-powered assessment of this page’s readiness for generative search engines.',
      style: 'sectionSubtitle',
      margin: [0, 0, 0, 16],
    },
    {
      text: metrics.summaryText,
      style: 'bodyText',
      margin: [0, 0, 0, 28],
    },
    { text: 'AI Readiness Checks', style: 'sectionTitle', margin: [0, 0, 0, 4] },
    {
      text: `${metrics.checks.length} checks scored from 0–100. Green ≥80, orange 60–79, red <60.`,
      style: 'sectionSubtitle',
      margin: [0, 0, 0, 16],
    },
    buildChecksTable(metrics),
  ];

  return {
    info: {
      title: `Analysis AI — ${metrics.url}`,
      author: brandLines.author,
      subject: `${brandLines.author} · AI Readiness Report`,
    },
    pageSize: 'LETTER',
    pageMargins: [48, 56, 48, 56],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: COLORS.slate700,
      lineHeight: 1.45,
    },
    styles: {
      coverEyebrow: {
        fontSize: 11,
        bold: true,
        color: COLORS.primary,
        characterSpacing: 2,
      },
      coverTitle: {
        fontSize: 28,
        bold: true,
        color: COLORS.slate900,
        lineHeight: 1.2,
      },
      coverUrl: {
        fontSize: 10,
        color: COLORS.slate500,
      },
      coverScore: {
        fontSize: 44,
        bold: true,
      },
      coverScoreLabel: {
        fontSize: 9,
        bold: true,
        color: COLORS.slate500,
        characterSpacing: 1.5,
      },
      coverDate: {
        fontSize: 11,
        color: COLORS.slate500,
      },
      coverBrand: {
        fontSize: 10,
        color: COLORS.primary,
        bold: true,
      },
      sectionTitle: {
        fontSize: 18,
        bold: true,
        color: COLORS.slate900,
      },
      sectionSubtitle: {
        fontSize: 10,
        color: COLORS.slate500,
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: COLORS.slate500,
        characterSpacing: 0.5,
      },
      tableCell: {
        fontSize: 10,
        color: COLORS.slate700,
        lineHeight: 1.4,
      },
      tableCellBold: {
        fontSize: 11,
        bold: true,
      },
      bodyText: {
        fontSize: 11,
        color: COLORS.slate700,
        lineHeight: 1.55,
      },
      footerText: {
        fontSize: 8,
        color: COLORS.slate500,
      },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${brandLines.footerLeft} · Analysis AI`, style: 'footerText', alignment: 'left' },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          style: 'footerText',
          alignment: 'right',
        },
      ],
      margin: [48, 0, 48, 24],
    }),
    content,
  };
}

export function buildAnalysisPdfFilename(url: string): string {
  let slug: string;

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    slug = hostname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  } catch {
    slug = 'page';
  }

  return `analysis-ai-${slug || 'report'}.pdf`;
}

export async function generateAnalysisPdfBlob(
  metrics: AnalysisMetrics,
  branding?: ReportBranding
): Promise<Blob> {
  const pdfMake = await getPdfMake();
  const docDefinition = buildDocumentDefinition(metrics, branding);
  const pdf = pdfMake.createPdf(docDefinition);

  return pdf.getBlob();
}

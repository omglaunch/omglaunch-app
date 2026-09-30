import { format } from 'date-fns';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { AuditData } from '@/lib/audit-data';
import type { SemanticCriterion } from '@/lib/semantic-metrics';

// Brand palette aligned with the Page Audit UI
const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  indigo: '#3730a3',
  slate900: '#111827',
  slate700: '#374151',
  slate500: '#6b7280',
  slate100: '#f3f4f6',
  slate50: '#f9fafb',
  white: '#ffffff',
  beforeBg: '#fef2f2',
  beforeText: '#991b1b',
  beforeLabel: '#dc2626',
  afterBg: '#ecfdf5',
  afterText: '#065f46',
  afterLabel: '#059669',
  violet: '#7c3aed',
  violetLight: '#f5f3ff',
  emerald: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  orange: '#ea580c',
  orangeLight: '#fff7ed',
} as const;

import type { ReportBranding } from '@/lib/projects/client-brand-shared';
import { formatReportBrandingLines } from '@/lib/projects/client-brand-shared';

export type AuditPdfInput = {
  url: string;
  targetKeyword: string;
  geoScore: number;
  createdAt: Date;
  data: AuditData;
  readabilityScore?: number | null;
  semanticGaps?: SemanticCriterion[];
  hasSemanticAnalysis?: boolean;
  branding?: ReportBranding;
};

type PdfMakeInstance = Awaited<ReturnType<typeof loadPdfMake>>;

let pdfMakePromise: Promise<PdfMakeInstance> | null = null;

async function loadPdfMake() {
  // 1. Load the core library FIRST
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;

  // 2. Load the fonts SECOND so they can attach to the initialized library
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;

  // 3. Safely extract the Virtual File System (Checking the module, then checking the window)
  const vfs = 
    pdfFonts?.pdfMake?.vfs || 
    pdfFonts?.vfs || 
    (typeof window !== 'undefined' && (window as any).pdfMake?.vfs);

  // 4. Assign the fonts
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

function buildCoverPage(input: AuditPdfInput): Content {
  const { targetKeyword, url, geoScore, createdAt, branding } = input;
  const brandLines = formatReportBrandingLines(branding);
  const scoreFill = scoreColor(geoScore);

  return {
    stack: [
      { text: ' ', margin: [0, 80, 0, 0] },
      {
        text: 'PAGE AUDIT REPORT',
        style: 'coverEyebrow',
        alignment: 'center',
      },
      {
        text: targetKeyword,
        style: 'coverTitle',
        alignment: 'center',
        margin: [40, 16, 40, 12],
      },
      {
        text: url,
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
                    text: geoScore.toFixed(0),
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
        text: format(new Date(createdAt), 'MMMM d, yyyy · h:mm a'),
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

function formatReadability(readabilityScore: number | null | undefined): {
  text: string;
  color?: string;
} {
  if (readabilityScore === null || readabilityScore === undefined) {
    return { text: '—' };
  }

  return {
    text: `${readabilityScore}%`,
    color: scoreColor(readabilityScore),
  };
}

function buildMetricsTable(
  data: AuditData,
  geoScore: number,
  readabilityScore?: number | null
): Content {
  const images = data.images ?? { total: 0, missingAlt: 0 };
  const altCoverage =
    images.total > 0
      ? `${Math.round(((images.total - images.missingAlt) / images.total) * 100)}%`
      : '—';
  const readability = formatReadability(readabilityScore);

  return {
    table: {
      headerRows: 1,
      widths: ['*', '*', '*', '*', '*'],
      body: [
        [
          { text: 'GEO Score', style: 'tableHeader' },
          { text: 'Word Count', style: 'tableHeader' },
          { text: 'Headings', style: 'tableHeader' },
          { text: 'Alt Coverage', style: 'tableHeader' },
          { text: 'Readability', style: 'tableHeader' },
        ],
        [
          {
            text: `${geoScore.toFixed(0)} / 100`,
            style: 'tableCellBold',
            color: scoreColor(geoScore),
          },
          { text: data.wordCount?.toLocaleString() ?? '—', style: 'tableCell' },
          { text: String(data.headings?.length ?? 0), style: 'tableCell' },
          { text: altCoverage, style: 'tableCell' },
          {
            text: readability.text,
            style: 'tableCellBold',
            color: readability.color,
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => COLORS.slate100,
      vLineColor: () => COLORS.slate100,
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 10,
      paddingBottom: () => 10,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.slate50 : null),
    },
    margin: [0, 0, 0, 8],
  };
}

function buildActionPlanItem(item: NonNullable<AuditData['actionPlan']>[number], index: number): Content {
  return {
    stack: [
      {
        columns: [
          {
            width: 24,
            text: String(index + 1),
            style: 'actionNumber',
            margin: [0, 2, 0, 0],
          },
          {
            width: '*',
            stack: [
              { text: item.title, style: 'actionTitle' },
              { text: item.reasoning, style: 'actionReasoning', margin: [0, 4, 0, 12] },
            ],
          },
        ],
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                text: 'BEFORE',
                style: 'beforeLabel',
                fillColor: COLORS.beforeBg,
                border: [false, false, false, false],
              },
              {
                text: 'AFTER',
                style: 'afterLabel',
                fillColor: COLORS.afterBg,
                border: [false, false, false, false],
              },
            ],
            [
              {
                text: item.currentText,
                style: 'beforeText',
                fillColor: COLORS.beforeBg,
                border: [false, false, false, false],
              },
              {
                text: item.suggestedText,
                style: 'afterText',
                fillColor: COLORS.afterBg,
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 14,
          paddingRight: () => 14,
          paddingTop: () => 10,
          paddingBottom: () => 10,
        },
      },
    ],
    margin: [0, 0, 0, 20],
  };
}

function buildSemanticGapItem(criterion: SemanticCriterion, index: number): Content {
  const isMissing = criterion.occurrence.current === 0;

  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              {
                columns: [
                  {
                    width: 14,
                    text: '●',
                    color: COLORS.red,
                    fontSize: 8,
                    margin: [0, 2, 0, 0],
                  },
                  {
                    width: '*',
                    stack: [
                      { text: criterion.expression, style: 'gapTitle' },
                      {
                        text: `Interest ${criterion.interestScore} · Used ${criterion.occurrence.current}x`,
                        style: 'gapMeta',
                        margin: [0, 2, 0, 6],
                      },
                    ],
                  },
                ],
              },
              {
                text: criterion.context || 'No context snippet available.',
                style: 'gapContext',
              },
              {
                text: isMissing
                  ? 'Missing from page content'
                  : 'Present but outside healthy usage range',
                style: isMissing ? 'gapStatusMissing' : 'gapStatusWarning',
                margin: [0, 6, 0, 0],
              },
            ],
            fillColor: index % 2 === 0 ? COLORS.white : COLORS.slate50,
            border: [false, false, false, false],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => COLORS.slate100,
      vLineColor: () => COLORS.slate100,
      paddingLeft: () => 14,
      paddingRight: () => 14,
      paddingTop: () => 12,
      paddingBottom: () => 12,
    },
    margin: [0, 0, 0, 10],
  };
}

function buildSemanticGapsSection(input: AuditPdfInput): Content[] {
  const { semanticGaps = [], hasSemanticAnalysis = false } = input;

  const sectionHeader: Content = {
    text: 'Top Semantic Entity Gaps',
    style: 'sectionTitle',
    pageBreak: 'before',
    margin: [0, 0, 0, 4],
  };

  const sectionSubtitle: Content = {
    text: 'High-interest expressions that are absent or overused on your page.',
    style: 'sectionSubtitle',
    margin: [0, 0, 0, 16],
  };

  if (!hasSemanticAnalysis) {
    return [
      sectionHeader,
      sectionSubtitle,
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'Semantic depth was not loaded for this session. Run "Analyze Semantic Depth" on the audit page to include entity gap analysis in future exports.',
                style: 'placeholderText',
                fillColor: COLORS.slate50,
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => COLORS.slate100,
          vLineColor: () => COLORS.slate100,
          paddingLeft: () => 16,
          paddingRight: () => 16,
          paddingTop: () => 14,
          paddingBottom: () => 14,
        },
      },
    ];
  }

  if (semanticGaps.length === 0) {
    return [
      sectionHeader,
      sectionSubtitle,
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'No major semantic gaps detected — your page covers the top high-interest expressions well.',
                style: 'gapSuccessText',
                fillColor: '#ecfdf5',
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#a7f3d0',
          vLineColor: () => '#a7f3d0',
          paddingLeft: () => 16,
          paddingRight: () => 16,
          paddingTop: () => 14,
          paddingBottom: () => 14,
        },
      },
    ];
  }

  return [
    sectionHeader,
    sectionSubtitle,
    ...semanticGaps.map((criterion, index) => buildSemanticGapItem(criterion, index)),
  ];
}

function buildPageTitleSection(data: AuditData): Content[] {
  return [
    {
      text: 'Page Title',
      style: 'subsectionTitle',
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Exact title tag crawled from the page.',
      style: 'subsectionSubtitle',
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: data.title ?? 'No title found.',
              style: data.title ? 'structuralBody' : 'placeholderText',
              fillColor: COLORS.slate50,
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => COLORS.slate100,
        vLineColor: () => COLORS.slate100,
        paddingLeft: () => 14,
        paddingRight: () => 14,
        paddingTop: () => 12,
        paddingBottom: () => 12,
      },
      margin: [0, 0, 0, 20],
    },
  ];
}

function buildImageAltStatsSection(data: AuditData): Content[] {
  const images = data.images ?? { total: 0, missingAlt: 0 };
  const withAlt = images.total - images.missingAlt;

  return [
    {
      text: 'Image Alt Text Stats',
      style: 'subsectionTitle',
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Accessibility signals from crawled images.',
      style: 'subsectionSubtitle',
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'TOTAL', style: 'statGridLabel', alignment: 'center' },
            { text: 'WITH ALT', style: 'statGridLabel', alignment: 'center' },
            { text: 'MISSING', style: 'statGridLabel', alignment: 'center' },
          ],
          [
            {
              text: String(images.total),
              style: 'statGridValue',
              alignment: 'center',
              fillColor: COLORS.slate50,
            },
            {
              text: String(withAlt),
              style: 'statGridValue',
              color: COLORS.emerald,
              alignment: 'center',
              fillColor: COLORS.slate50,
            },
            {
              text: String(images.missingAlt),
              style: 'statGridValue',
              color: images.missingAlt > 0 ? COLORS.red : COLORS.slate900,
              alignment: 'center',
              fillColor: COLORS.slate50,
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => COLORS.slate100,
        vLineColor: () => COLORS.slate100,
        paddingLeft: () => 12,
        paddingRight: () => 12,
        paddingTop: () => 12,
        paddingBottom: () => 12,
      },
      margin: [0, 0, 0, 20],
    },
  ];
}

function buildHeadingsSection(data: AuditData): Content[] {
  const headings = data.headings ?? [];

  const section: Content[] = [
    {
      text: 'H1 & H2 Headings',
      style: 'sectionTitle',
      pageBreak: 'before',
      margin: [0, 0, 0, 4],
    },
    {
      text: `Full list of heading elements parsed from the page (${headings.length} found).`,
      style: 'sectionSubtitle',
      margin: [0, 0, 0, 16],
    },
  ];

  if (headings.length === 0) {
    section.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: 'No H1 or H2 headings found.',
              style: 'placeholderText',
              fillColor: COLORS.slate50,
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => COLORS.slate100,
        vLineColor: () => COLORS.slate100,
        paddingLeft: () => 16,
        paddingRight: () => 16,
        paddingTop: () => 14,
        paddingBottom: () => 14,
      },
    });

    return section;
  }

  const headingRows: Content[][] = headings.map((heading, index) => [
    {
      columns: [
        {
          width: 22,
          text: String(index + 1),
          style: 'headingIndex',
        },
        {
          width: '*',
          text: heading,
          style: 'headingText',
        },
      ],
      fillColor: index % 2 === 0 ? COLORS.white : COLORS.slate50,
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    },
  ]);

  section.push({
    table: {
      widths: ['*'],
      body: headingRows,
    },
    layout: {
      hLineWidth: (rowIndex: number, node: { table: { body: unknown[] } }) =>
        rowIndex === 0 || rowIndex === node.table.body.length ? 1 : 0.5,
      vLineWidth: () => 1,
      hLineColor: () => COLORS.slate100,
      vLineColor: () => COLORS.slate100,
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 10,
      paddingBottom: () => 10,
    },
  });

  return section;
}

function buildStructuralSections(input: AuditPdfInput): Content[] {
  return [
    {
      text: 'Page Structure & Content',
      style: 'sectionTitle',
      pageBreak: 'before',
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Crawled structural signals from the audited page.',
      style: 'sectionSubtitle',
      margin: [0, 0, 0, 16],
    },
    ...buildPageTitleSection(input.data),
    ...buildImageAltStatsSection(input.data),
    ...buildHeadingsSection(input.data),
  ];
}

function buildDocumentDefinition(input: AuditPdfInput): TDocumentDefinitions {
  const { data, geoScore, targetKeyword, url, readabilityScore, branding } = input;
  const brandLines = formatReportBrandingLines(branding);
  const content: Content[] = [
    buildCoverPage(input),
    { text: 'Executive Summary', style: 'sectionTitle', margin: [0, 0, 0, 4] },
    {
      text: 'AI-powered GEO insights for this page and target keyword.',
      style: 'sectionSubtitle',
      margin: [0, 0, 0, 16],
    },
    buildMetricsTable(data, geoScore, readabilityScore),
    {
      table: {
        widths: ['30%', '70%'],
        body: [
          [
            { text: 'Target Keyword', style: 'metaLabel' },
            { text: targetKeyword, style: 'metaValue' },
          ],
          [
            { text: 'Page URL', style: 'metaLabel' },
            { text: url, style: 'metaValue' },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 20],
    },
    {
      text: data.analysis ?? 'No analysis available for this audit.',
      style: 'bodyText',
      margin: [0, 0, 0, 28],
    },
  ];

  if (data.actionPlan && data.actionPlan.length > 0) {
    content.push(
      { text: 'Recommended Action Plan', style: 'sectionTitle', pageBreak: 'before', margin: [0, 0, 0, 4] },
      {
        text: 'Copy-paste fixes to improve your GEO score.',
        style: 'sectionSubtitle',
        margin: [0, 0, 0, 20],
      },
      ...data.actionPlan.map((item, index) => buildActionPlanItem(item, index))
    );
  }

  if (data.bonusTip) {
    content.push(
      { text: 'Strategic Edge', style: 'sectionTitle', pageBreak: 'before', margin: [0, 0, 0, 4] },
      {
        text: 'Long-term positioning beyond immediate fixes.',
        style: 'sectionSubtitle',
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: 'PRO TIP', style: 'proTipLabel', margin: [0, 0, 0, 8] },
                  { text: data.bonusTip, style: 'proTipBody' },
                ],
                fillColor: COLORS.violetLight,
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 20,
          paddingRight: () => 20,
          paddingTop: () => 18,
          paddingBottom: () => 18,
        },
      }
    );
  }

  content.push(...buildSemanticGapsSection(input));
  content.push(...buildStructuralSections(input));

  return {
    info: {
      title: `Page Audit — ${targetKeyword}`,
      author: brandLines.author,
      subject: `${brandLines.author} · Generative Engine Optimization Report`,
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
        fontSize: 11,
        color: COLORS.slate700,
      },
      tableCellBold: {
        fontSize: 13,
        bold: true,
      },
      metaLabel: {
        fontSize: 9,
        bold: true,
        color: COLORS.slate500,
        characterSpacing: 0.5,
      },
      metaValue: {
        fontSize: 10,
        color: COLORS.slate900,
      },
      bodyText: {
        fontSize: 11,
        color: COLORS.slate700,
        lineHeight: 1.55,
      },
      actionNumber: {
        fontSize: 11,
        bold: true,
        color: COLORS.emerald,
        alignment: 'center',
      },
      actionTitle: {
        fontSize: 13,
        bold: true,
        color: COLORS.slate900,
      },
      actionReasoning: {
        fontSize: 10,
        color: COLORS.slate500,
        lineHeight: 1.45,
      },
      beforeLabel: {
        fontSize: 8,
        bold: true,
        color: COLORS.beforeLabel,
        characterSpacing: 1,
      },
      afterLabel: {
        fontSize: 8,
        bold: true,
        color: COLORS.afterLabel,
        characterSpacing: 1,
      },
      beforeText: {
        fontSize: 10,
        color: COLORS.beforeText,
        lineHeight: 1.45,
      },
      afterText: {
        fontSize: 10,
        bold: true,
        color: COLORS.afterText,
        lineHeight: 1.45,
      },
      proTipLabel: {
        fontSize: 9,
        bold: true,
        color: COLORS.violet,
        characterSpacing: 1.5,
      },
      proTipBody: {
        fontSize: 11,
        color: COLORS.slate700,
        lineHeight: 1.55,
      },
      footerText: {
        fontSize: 8,
        color: COLORS.slate500,
      },
      subsectionTitle: {
        fontSize: 14,
        bold: true,
        color: COLORS.slate900,
      },
      subsectionSubtitle: {
        fontSize: 9,
        color: COLORS.slate500,
      },
      structuralBody: {
        fontSize: 10,
        color: COLORS.slate700,
        lineHeight: 1.5,
      },
      placeholderText: {
        fontSize: 10,
        color: COLORS.slate500,
        italics: true,
        lineHeight: 1.45,
      },
      statGridLabel: {
        fontSize: 8,
        bold: true,
        color: COLORS.slate500,
        characterSpacing: 0.8,
      },
      statGridValue: {
        fontSize: 18,
        bold: true,
        color: COLORS.slate900,
      },
      gapTitle: {
        fontSize: 12,
        bold: true,
        color: COLORS.slate900,
      },
      gapMeta: {
        fontSize: 9,
        color: COLORS.slate500,
      },
      gapContext: {
        fontSize: 10,
        color: COLORS.slate700,
        lineHeight: 1.45,
      },
      gapStatusMissing: {
        fontSize: 9,
        bold: true,
        color: COLORS.red,
      },
      gapStatusWarning: {
        fontSize: 9,
        bold: true,
        color: COLORS.amber,
      },
      gapSuccessText: {
        fontSize: 10,
        color: COLORS.afterText,
        lineHeight: 1.45,
      },
      headingIndex: {
        fontSize: 9,
        bold: true,
        color: COLORS.slate500,
        alignment: 'center',
      },
      headingText: {
        fontSize: 10,
        color: COLORS.slate700,
        lineHeight: 1.45,
      },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${brandLines.footerLeft} · Page Audit`, style: 'footerText', alignment: 'left' },
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

export function buildAuditPdfFilename(targetKeyword: string, auditId: number): string {
  const slug = targetKeyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return `page-audit-${slug || auditId}.pdf`;
}

export async function generateAuditPdf(input: AuditPdfInput): Promise<Buffer> {
  const pdfMake = await getPdfMake();
  const docDefinition = buildDocumentDefinition(input);
  const pdf = pdfMake.createPdf(docDefinition);
  const buffer = await pdf.getBuffer();

  return Buffer.from(buffer);
}

export async function generateAuditPdfBlob(input: AuditPdfInput): Promise<Blob> {
  const pdfMake = await getPdfMake();
  const docDefinition = buildDocumentDefinition(input);
  const pdf = pdfMake.createPdf(docDefinition);

  return pdf.getBlob();
}

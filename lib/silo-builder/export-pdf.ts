import { format } from 'date-fns';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { computeSiloProjectMetrics } from '@/lib/silo-builder/metrics';
import {
  formatMetricsConfidenceLabel,
} from '@/lib/silo-builder/metrics-confidence';
import type { SiloNodeDto, SiloProjectDto } from '@/lib/silo-builder/types';

const COLORS = {
  primary: '#2563eb',
  slate900: '#111827',
  slate700: '#374151',
  slate500: '#6b7280',
  slate100: '#f3f4f6',
  white: '#ffffff',
  indigo: '#3730a3',
} as const;

type PdfMakeInstance = {
  createPdf: (doc: TDocumentDefinitions) => {
    getBuffer: () => Promise<unknown>;
    getBlob: () => Promise<Blob>;
  };
  vfs?: unknown;
  fonts?: Record<string, unknown>;
};

let pdfMakePromise: Promise<PdfMakeInstance> | null = null;

async function loadPdfMake(): Promise<PdfMakeInstance> {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfMake = (pdfMakeModule as { default?: unknown }).default || pdfMakeModule;

  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfFonts = (pdfFontsModule as { default?: unknown }).default || pdfFontsModule;

  const vfs =
    (pdfFonts as { pdfMake?: { vfs?: unknown }; vfs?: unknown })?.pdfMake?.vfs ||
    (pdfFonts as { vfs?: unknown })?.vfs ||
    (typeof window !== 'undefined' &&
      (window as { pdfMake?: { vfs?: unknown } }).pdfMake?.vfs);

  (pdfMake as { vfs?: unknown }).vfs = vfs;
  (pdfMake as { fonts?: Record<string, unknown> }).fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };

  return pdfMake as PdfMakeInstance;
}

function getPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = loadPdfMake();
  }

  return pdfMakePromise;
}

function formatMetric(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }

  return value.toLocaleString();
}

function formatPdfVolume(node: SiloNodeDto): string {
  if (node.searchVolume === null || node.searchVolume === undefined) {
    return node.metricsConfidence === 'unavailable' ? '—' : 'N/A';
  }

  return node.searchVolume.toLocaleString();
}

function formatPdfKd(node: SiloNodeDto): string {
  if (node.difficulty === null || node.difficulty === undefined) {
    return node.metricsConfidence === 'unavailable' ? '—' : 'N/A';
  }

  return String(node.difficulty);
}

function formatPdfKeyword(node: SiloNodeDto): string | Content {
  const keyword = node.targetKeyword || '—';
  if (!node.originalTargetKeyword) {
    return truncateText(keyword, 32);
  }

  return {
    stack: [
      { text: truncateText(keyword, 32), style: 'tableCell' },
      {
        text: `was: ${truncateText(node.originalTargetKeyword, 28)}`,
        style: 'tableSubCell',
      },
    ],
  };
}

function buildMetricsConfidenceFootnotes(
  project: SiloProjectDto,
  metrics: ReturnType<typeof computeSiloProjectMetrics>
): Content[] {
  const spokes = project.nodes.filter(node => node.type === 'SPOKE');
  const verifiedCount = spokes.filter(
    node => node.metricsConfidence === 'exact'
  ).length;
  const resolvedCount = spokes.filter(
    node => node.metricsConfidence === 'resolved'
  ).length;
  const unverifiedCount = spokes.filter(
    node =>
      node.metricsConfidence === 'unavailable' || !node.metricsConfidence
  ).length;
  const legacyCount = spokes.filter(
    node => node.metricsConfidence === null && node.searchVolume !== null
  ).length;

  const competitiveIndexNote =
    metrics.competitiveIndex === null
      ? 'Competitive Index is unavailable because no spokes have verified keyword difficulty.'
      : metrics.verifiedSpokeCount < Math.ceil(metrics.totalSpokeCount / 2)
        ? `Competitive Index (${metrics.competitiveIndex}) is preliminary — only ${metrics.verifiedSpokeCount} of ${metrics.totalSpokeCount} spokes have verified KD. Treat values below 50% verified coverage as directional only.`
        : `Competitive Index (${metrics.competitiveIndex}) uses volume-weighted KD from ${metrics.verifiedSpokeCount} verified spokes.`;

  const lines: Content[] = [
    { text: 'How to read these metrics', style: 'footnoteHeading' },
    {
      text: 'Search volumes and keyword difficulty (KD) come from DataForSEO Labs for the report geography. KD is scored 0–100 (higher = harder to rank in the top 10).',
      style: 'footnote',
    },
    {
      text: '• Verified — exact match for the canonical keyword in DataForSEO.',
      style: 'footnote',
    },
    {
      text: '• Resolved — keyword was normalized or matched to a competitor ranked term before lookup (see “was:” notes in the table).',
      style: 'footnote',
    },
    {
      text: '• Unverified — no reliable volume or KD for this geography; do not use for prioritization.',
      style: 'footnote',
    },
    {
      text: `Spoke breakdown: ${verifiedCount} verified, ${resolvedCount} resolved, ${unverifiedCount} unverified${legacyCount ? `, ${legacyCount} legacy` : ''}.`,
      style: 'footnote',
    },
    { text: competitiveIndexNote, style: 'footnote' },
    {
      text: 'Traffic pool sums spoke search volumes only. Spokes marked “—” for volume or KD were excluded from difficulty averages.',
      style: 'footnote',
    },
    {
      text: 'Validate high-stakes keywords in an external SEO tool before committing production resources.',
      style: 'footnote',
      margin: [0, 0, 0, 12],
    },
  ];

  return lines;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function buildDocumentDefinition(project: SiloProjectDto): TDocumentDefinitions {
  const metrics = computeSiloProjectMetrics(project.nodes);
  const pillar = project.nodes.find(node => node.type === 'PILLAR');
  const spokes = project.nodes.filter(node => node.type === 'SPOKE');
  const exportedAt = format(new Date(), 'MMM d, yyyy h:mm a');
  const projectTypeLabel =
    project.type === 'COMPETITOR' ? 'Competitor Attack Map' : 'Hub & Spoke Silo';

  const metadataLines: Content[] = [
    { text: `Type: ${projectTypeLabel}`, style: 'meta' },
  ];

  if (project.geography) {
    metadataLines.push({ text: `Geography: ${project.geography}`, style: 'meta' });
  }

  if (project.niche) {
    metadataLines.push({ text: `Niche: ${project.niche}`, style: 'meta' });
  }

  if (project.domain) {
    metadataLines.push({ text: `Competitor: ${project.domain}`, style: 'meta' });
  }

  if (project.seedKeyword) {
    metadataLines.push({ text: `Seed keyword: ${project.seedKeyword}`, style: 'meta' });
  }

  metadataLines.push({ text: `Exported: ${exportedAt}`, style: 'meta' });
  metadataLines.push({
    text: `Verified spokes: ${metrics.verifiedSpokeCount}/${metrics.totalSpokeCount}`,
    style: 'meta',
  });

  const competitiveIndexIsPreliminary =
    metrics.competitiveIndex !== null &&
    metrics.verifiedSpokeCount < Math.ceil(metrics.totalSpokeCount / 2);

  const content: Content[] = [
    { text: 'Content Silo Strategy Report', style: 'title' },
    { text: project.title, style: 'subtitle' },
    { text: '', margin: [0, 0, 0, 8] },
    ...metadataLines,
    { text: '', margin: [0, 0, 0, 12] },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Traffic Pool', style: 'metricLabel' },
            {
              text: competitiveIndexIsPreliminary
                ? 'Competitive Index*'
                : 'Competitive Index',
              style: 'metricLabel',
            },
            { text: 'Connections', style: 'metricLabel' },
          ],
          [
            { text: formatMetric(metrics.totalTrafficPool), style: 'metricValue' },
            {
              text:
                metrics.competitiveIndex === null
                  ? 'N/A'
                  : String(metrics.competitiveIndex),
              style: 'metricValue',
            },
            {
              text: metrics.architecturalConnections.toLocaleString(),
              style: 'metricValue',
            },
          ],
        ],
      },
      layout: {
        fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.slate100 : COLORS.white),
        hLineColor: () => '#e5e7eb',
        vLineColor: () => '#e5e7eb',
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 18],
    },
    ...buildMetricsConfidenceFootnotes(project, metrics),
  ];

  if (pillar) {
    content.push(
      { text: 'Pillar Hub', style: 'sectionHeading' },
      {
        ul: [
          `Title: ${pillar.title}`,
          `Target keyword: ${pillar.targetKeyword || 'N/A'}`,
          pillar.originalTargetKeyword
            ? `Resolved from: ${pillar.originalTargetKeyword}`
            : null,
          `Search volume: ${formatPdfVolume(pillar)}`,
          `Difficulty: ${formatPdfKd(pillar)}`,
          `Metrics confidence: ${formatMetricsConfidenceLabel(pillar.metricsConfidence)}`,
          `Intent: ${pillar.intent || 'N/A'}`,
          `Status: ${pillar.status}`,
        ].filter((line): line is string => Boolean(line)),
        style: 'bulletList',
        margin: [0, 0, 0, 16],
      }
    );
  }

  if (spokes.length > 0) {
    content.push(
      { text: 'Spoke Architecture', style: 'sectionHeading' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', 55, 45, 50, 55, 60],
          body: [
            [
              { text: 'Title', style: 'tableHeader' },
              { text: 'Keyword', style: 'tableHeader' },
              { text: 'Volume', style: 'tableHeader' },
              { text: 'KD', style: 'tableHeader' },
              { text: 'Intent', style: 'tableHeader' },
              { text: 'Status', style: 'tableHeader' },
              { text: 'Confidence', style: 'tableHeader' },
            ],
            ...spokes.map(spoke => [
              truncateText(spoke.title, 48),
              formatPdfKeyword(spoke),
              formatPdfVolume(spoke),
              formatPdfKd(spoke),
              truncateText(spoke.intent || '—', 18),
              spoke.status,
              formatMetricsConfidenceLabel(spoke.metricsConfidence),
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? COLORS.indigo : rowIndex % 2 === 0 ? COLORS.white : COLORS.slate100,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 8],
      },
      {
        text: 'KD values marked — indicate unverified difficulty. Resolved keywords show the original Gemini phrase under the canonical query.',
        style: 'footnote',
        margin: [0, 0, 0, 18],
      }
    );
  }

  if (project.type === 'COMPETITOR' && project.semanticGaps.length > 0) {
    content.push(
      { text: 'Semantic Gaps', style: 'sectionHeading' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 55, '*'],
          body: [
            [
              { text: 'Topic', style: 'tableHeader' },
              { text: 'Priority', style: 'tableHeader' },
              { text: 'Rationale', style: 'tableHeader' },
            ],
            ...project.semanticGaps.map(gap => [
              truncateText(gap.topic, 56),
              gap.priority,
              truncateText(gap.rationale, 120),
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? COLORS.indigo : rowIndex % 2 === 0 ? COLORS.white : COLORS.slate100,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 18],
      }
    );
  }

  if (project.type === 'COMPETITOR' && project.hubGroups.length > 0) {
    content.push(
      { text: 'Hub Groups', style: 'sectionHeading' },
      {
        ul: project.hubGroups.map(
          group =>
            `${group.hubTitle} (${group.hubKeyword}): ${group.spokeTitles.join(', ')}`
        ),
        style: 'bulletList',
        margin: [0, 0, 0, 18],
      }
    );
  }

  if (project.type === 'COMPETITOR' && project.rankedKeywords.length > 0) {
    const topKeywords = project.rankedKeywords.slice(0, 25);

    content.push(
      { text: 'Top Competitor Keywords', style: 'sectionHeading' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 70, 45],
          body: [
            [
              { text: 'Keyword', style: 'tableHeader' },
              { text: 'Volume', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
            ],
            ...topKeywords.map(keyword => [
              truncateText(keyword.keyword, 48),
              formatMetric(keyword.searchVolume),
              keyword.rank ?? '—',
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? COLORS.indigo : rowIndex % 2 === 0 ? COLORS.white : COLORS.slate100,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      }
    );
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: COLORS.slate700,
      lineHeight: 1.35,
    },
    styles: {
      title: {
        fontSize: 20,
        bold: true,
        color: COLORS.primary,
        margin: [0, 0, 0, 4],
      },
      subtitle: {
        fontSize: 14,
        bold: true,
        color: COLORS.slate900,
        margin: [0, 0, 0, 10],
      },
      meta: {
        fontSize: 9,
        color: COLORS.slate500,
        margin: [0, 0, 0, 2],
      },
      sectionHeading: {
        fontSize: 12,
        bold: true,
        color: COLORS.slate900,
        margin: [0, 0, 0, 8],
      },
      metricLabel: {
        fontSize: 9,
        bold: true,
        color: COLORS.slate500,
      },
      metricValue: {
        fontSize: 14,
        bold: true,
        color: COLORS.slate900,
      },
      footnoteHeading: {
        fontSize: 10,
        bold: true,
        color: COLORS.slate900,
        margin: [0, 0, 0, 4],
      },
      footnote: {
        fontSize: 8,
        color: COLORS.slate500,
        margin: [0, 0, 0, 3],
      },
      tableCell: {
        fontSize: 9,
        color: COLORS.slate700,
      },
      tableSubCell: {
        fontSize: 7,
        color: COLORS.slate500,
        italics: true,
        margin: [0, 2, 0, 0],
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: COLORS.white,
      },
      bulletList: {
        fontSize: 10,
        color: COLORS.slate700,
      },
    },
    content,
  };
}

export async function generateSiloProjectPdfBlob(project: SiloProjectDto): Promise<Blob> {
  const pdfMake = await getPdfMake();
  const docDefinition = buildDocumentDefinition(project);
  const pdf = pdfMake.createPdf(docDefinition);

  return pdf.getBlob();
}

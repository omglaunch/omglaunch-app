import type { SiloNodeDto } from '@/lib/silo-builder/types';
import { formatMetricsConfidenceLabel } from '@/lib/silo-builder/metrics-confidence';

const CSV_HEADERS = [
  'Project',
  'Node Title',
  'Type',
  'Target Keyword',
  'Original Keyword',
  'Keyword Source',
  'Metrics Confidence',
  'Search Volume',
  'Keyword Difficulty',
  'Intent',
  'Funnel Stage',
  'Status',
  'Anchor To Pillar',
  'Lateral Links',
  'Semantic Entities',
  'Slug',
  'WordPress Post ID',
] as const;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatLateralLinks(node: SiloNodeDto): string {
  if (!node.lateralLinks.length) {
    return '';
  }

  return node.lateralLinks
    .map(link => `${link.spokeTitle} (${link.suggestedLateralAnchorText})`)
    .join('; ');
}

function sortNodesForExport(nodes: SiloNodeDto[]): SiloNodeDto[] {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'PILLAR' ? -1 : 1;
    }

    return left.title.localeCompare(right.title);
  });
}

function nodeToCsvRow(projectTitle: string, node: SiloNodeDto): string[] {
  return [
    projectTitle,
    node.title,
    node.type,
    node.targetKeyword ?? '',
    node.originalTargetKeyword ?? '',
    node.keywordSource ?? '',
    formatMetricsConfidenceLabel(node.metricsConfidence),
    node.searchVolume ?? '',
    node.difficulty ?? '',
    node.intent ?? '',
    node.funnelStage ?? '',
    node.status,
    node.anchorTextToPillar ?? '',
    formatLateralLinks(node),
    node.semanticEntities.join('; '),
    node.slug ?? '',
    node.wpPostId ?? '',
  ].map(value => escapeCsvCell(value));
}

export function buildSiloNodesCsv(projectTitle: string, nodes: SiloNodeDto[]): string {
  const rows = [
    CSV_HEADERS.join(','),
    ...sortNodesForExport(nodes).map(node =>
      nodeToCsvRow(projectTitle, node).join(',')
    ),
  ];

  return rows.join('\n');
}

export function createSiloNodesCsvBlob(
  projectTitle: string,
  nodes: SiloNodeDto[]
): Blob {
  return new Blob([buildSiloNodesCsv(projectTitle, nodes)], {
    type: 'text/csv;charset=utf-8',
  });
}

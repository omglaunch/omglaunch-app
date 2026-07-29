import type { ReportBranding } from '@/lib/projects/client-brand-shared';
import { formatReportBrandingLines } from '@/lib/projects/client-brand-shared';
import type { RankTrackerKeywordRow } from '@/lib/rank-tracker/types';
import { formatRankDisplay, resolveDisplayHistory } from '@/lib/rank-tracker/utils';

function escapeCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function slugifyFilename(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'client-brand';
}

export function buildRankTrackerCsvFilename(
  branding: ReportBranding,
  projectId: string
): string {
  const brandSlug = slugifyFilename(branding.clientBrandLabel);
  const date = new Date().toISOString().slice(0, 10);
  return `${brandSlug}-rank-tracker-${date}-${projectId.slice(0, 8)}.csv`;
}

export function buildRankTrackerCsv(
  rows: RankTrackerKeywordRow[],
  branding: ReportBranding
): string {
  const brandLines = formatReportBrandingLines(branding);
  const exportedAt = new Date().toISOString();

  const metadata = [
    ['Client brand', brandLines.author],
    ['Prepared by', branding.agencyName],
    ['Client website', branding.clientWebsite ?? ''],
    ['Exported at', exportedAt],
    ['Entity profile published', branding.isManifestPublished ? 'Yes' : 'No'],
  ];

  const header = [
    'Keyword',
    'Target URL',
    'Position',
    'Search Volume',
    'CPC',
    'Intent',
    'URL Found',
    'Active',
  ];

  const dataLines = rows.map(row => [
    row.keyword,
    row.targetUrl ?? '',
    formatRankDisplay(resolveDisplayHistory(row), row.currentRank),
    row.searchVolume ?? '',
    row.cpc ?? '',
    row.intent,
    resolveDisplayHistory(row)?.urlFound ?? row.rankedUrl ?? '',
    row.isActive ? 'Yes' : 'No',
  ]);

  return [
    ...metadata.map(cols => cols.map(escapeCsvCell).join(',')),
    '',
    header.map(escapeCsvCell).join(','),
    ...dataLines.map(cols => cols.map(escapeCsvCell).join(',')),
  ].join('\n');
}

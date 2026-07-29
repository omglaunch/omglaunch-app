import { parseAuditData } from '@/lib/audit-data';
import { resolveClientBrandLabel } from '@/lib/projects/client-brand';
import { serializeBrandProfile } from '@/lib/ai-visibility/aeo-brand-profile';
import { buildVisibilitySnapshot, listVisibilityRowsByProject } from '@/lib/ai-visibility/visibility-repository';
import { listRankTrackerKeywordRows } from '@/lib/rank-tracker/server';
import {
  computeAverageRank,
  computeTop3Count,
  computeVisibilityScore,
} from '@/lib/rank-tracker/utils';
import { getPrisma } from '@/lib/prisma';
import type {
  AiVisibilityShareRow,
  AiVisibilityShareSnapshot,
  ClientShareReportType,
  ClientShareSnapshotMeta,
  PageAuditShareSnapshot,
  RankTrackerShareSnapshot,
} from '@/lib/client-share/types';
import { CLIENT_SHARE_REPORT_LABELS } from '@/lib/client-share/types';

function summarizeCitationStatus(
  citation: { kind: string; rank?: number }
): string {
  if (citation.kind === 'cited' && typeof citation.rank === 'number') {
    return `Cited #${citation.rank}`;
  }
  if (citation.kind === 'inline_link') return 'Inline link';
  if (citation.kind === 'text_mention') return 'Mention';
  if (citation.kind === 'not_cited') return 'Not cited';
  if (citation.kind === 'pending') return 'Pending';
  return citation.kind.replace(/_/g, ' ');
}

async function loadShareMeta(projectId: string, workspaceId: string): Promise<ClientShareSnapshotMeta> {
  const prisma = getPrisma();
  const [project, brandProfile, workspace] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { name: true },
    }),
    prisma.aeoBrandProfile.findUnique({
      where: { projectId },
    }),
    prisma.workspaceSettings.findFirst({
      where: { workspaceId },
      select: { name: true, reportLogoUrl: true },
    }),
  ]);

  if (!project) {
    throw new Error('Project not found.');
  }

  const profile = brandProfile ? serializeBrandProfile(brandProfile) : null;

  return {
    clientBrandLabel: resolveClientBrandLabel({
      brandLabel: profile?.brandLabel ?? null,
      projectName: project.name,
      fallback: project.name,
    }),
    agencyName: workspace?.name?.trim() || 'Agency',
    reportLogoUrl: workspace?.reportLogoUrl ?? null,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
  };
}

export async function buildRankTrackerShareSnapshot(
  projectId: string,
  workspaceId: string
): Promise<RankTrackerShareSnapshot> {
  const keywords = await listRankTrackerKeywordRows(projectId, workspaceId);
  const meta = await loadShareMeta(projectId, workspaceId);

  return {
    meta,
    summary: {
      visibilityScore: computeVisibilityScore(keywords),
      averageRank: computeAverageRank(keywords),
      top3Count: computeTop3Count(keywords),
      keywordCount: keywords.length,
    },
    keywords: keywords.map(row => ({
      keyword: row.keyword,
      currentRank: row.currentRank,
      previousRank: row.latestHistory?.previousPosition ?? null,
      searchVolume: row.searchVolume,
      intent: row.intent,
      rankedUrl: row.rankedUrl,
      location: row.location,
    })),
  };
}

export async function buildAiVisibilityShareSnapshot(
  projectId: string,
  workspaceId: string
): Promise<AiVisibilityShareSnapshot> {
  const [rows, metrics, meta] = await Promise.all([
    listVisibilityRowsByProject(projectId),
    buildVisibilitySnapshot(projectId),
    loadShareMeta(projectId, workspaceId),
  ]);

  const activeRows = rows.filter(row => !row.suspended).slice(0, 50);

  const shareRows: AiVisibilityShareRow[] = activeRows.map(row => ({
    prompt: row.prompt,
    promptCluster: row.promptCluster,
    geoTarget: row.geoTarget,
    googleAio: summarizeCitationStatus(row.googleAio),
    perplexity: summarizeCitationStatus(row.perplexity),
    chatgpt: summarizeCitationStatus(row.chatgpt),
    claude: summarizeCitationStatus(row.claude),
  }));

  return {
    meta,
    metrics: {
      totalCitationShare: metrics.totalCitationShare,
      promptClustersTracked: metrics.promptClustersTracked,
      top3CitationsSecured: metrics.top3CitationsSecured,
      competitorDeltaShareOfVoice: metrics.competitorDeltaShareOfVoice,
      lastUpdatedAt: metrics.lastUpdatedAt,
      activeNonSuspendedPrompts: metrics.activeNonSuspendedPrompts,
    },
    rows: shareRows,
  };
}

export async function buildPageAuditShareSnapshot(
  projectId: string,
  workspaceId: string,
  auditId: number
): Promise<PageAuditShareSnapshot> {
  const prisma = getPrisma();
  await prisma.project.findFirstOrThrow({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });

  const audit = await prisma.pageAudit.findUnique({
    where: { id: auditId },
  });

  if (!audit) {
    throw new Error('Page audit not found.');
  }

  const parsed = parseAuditData(audit.auditData);
  const meta = await loadShareMeta(projectId, workspaceId);
  const analysis = parsed.analysis?.trim() ?? null;

  return {
    meta,
    audit: {
      auditId: audit.id,
      url: audit.url,
      targetKeyword: audit.targetKeyword,
      geoScore: audit.geoScore,
      createdAt: audit.createdAt.toISOString(),
      title: parsed.title ?? null,
      wordCount: parsed.wordCount ?? null,
      headings: (parsed.headings ?? []).slice(0, 8),
      analysisExcerpt: analysis ? analysis.slice(0, 600) : null,
      actionPlan: (parsed.actionPlan ?? []).slice(0, 5).map(item => ({
        title: item.title,
        reasoning: item.reasoning,
      })),
    },
  };
}

export async function buildClientShareSnapshot(input: {
  reportType: ClientShareReportType;
  projectId: string;
  workspaceId: string;
  sourceId?: string | number | null;
}) {
  switch (input.reportType) {
    case 'rank_tracker':
      return buildRankTrackerShareSnapshot(input.projectId, input.workspaceId);
    case 'ai_visibility':
      return buildAiVisibilityShareSnapshot(input.projectId, input.workspaceId);
    case 'page_audit': {
      const auditId =
        typeof input.sourceId === 'number'
          ? input.sourceId
          : parseInt(String(input.sourceId ?? ''), 10);
      if (Number.isNaN(auditId)) {
        throw new Error('Page audit id is required.');
      }
      return buildPageAuditShareSnapshot(input.projectId, input.workspaceId, auditId);
    }
    default:
      throw new Error('Unsupported report type.');
  }
}

export function defaultShareTitle(
  reportType: ClientShareReportType,
  meta: ClientShareSnapshotMeta,
  extra?: string
): string {
  const base = `${meta.clientBrandLabel} · ${CLIENT_SHARE_REPORT_LABELS[reportType]}`;
  return extra ? `${base} · ${extra}` : base;
}

export function formatRankDelta(current: number | null, previous: number | null): string {
  if (current == null) return '—';
  if (previous == null) return `#${current}`;
  const delta = previous - current;
  if (delta === 0) return `#${current}`;
  return delta > 0 ? `#${current} ▲${delta}` : `#${current} ▼${Math.abs(delta)}`;
}

import { prisma } from '@/lib/prisma';
import type { RecentPageAudit } from '@/lib/page-audit/types';
import { listToolHistory } from '@/lib/tool-history/server';

export async function getRecentAudits(workspaceId: string): Promise<RecentPageAudit[]> {
  const scopedWorkspaceId = workspaceId?.trim();
  if (!scopedWorkspaceId) {
    return [];
  }

  const history = await listToolHistory('page-audit', {
    limit: 10,
    workspaceId: scopedWorkspaceId,
  });

  if (history.length === 0) {
    return [];
  }

  const entries = await prisma.pageAuditHistory.findMany({
    where: {
      id: { in: history.map(item => item.id) },
      workspaceId: scopedWorkspaceId,
    },
    orderBy: { createdAt: 'desc' },
  });

  return entries.map(entry => {
    const payload =
      typeof entry.resultData === 'object' && entry.resultData !== null
        ? (entry.resultData as Record<string, unknown>)
        : {};

    const legacyAuditId =
      typeof payload.legacyAuditId === 'number' ? payload.legacyAuditId : null;

    if (legacyAuditId) {
      return {
        historyId: entry.id,
        id: legacyAuditId,
        createdAt: entry.createdAt,
        url: String(payload.url ?? entry.identifier),
        targetKeyword: String(payload.targetKeyword ?? ''),
        geoScore: Number(payload.geoScore ?? 0),
        auditData: payload.auditData ?? {},
      };
    }

    return {
      historyId: entry.id,
      id: entry.id as unknown as number,
      createdAt: entry.createdAt,
      url: String(payload.url ?? entry.identifier),
      targetKeyword: String(payload.targetKeyword ?? ''),
      geoScore: Number(payload.geoScore ?? 0),
      auditData: payload.auditData ?? {},
    };
  });
}

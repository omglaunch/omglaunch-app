import { NextResponse } from 'next/server';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { getPrisma } from '@/lib/prisma';
import { enrichKeywordWithMetrics } from '@/lib/silo-builder/enrich-node-metrics';
import { syncSiloProjectMetricsStatus } from '@/lib/silo-builder/enrich-metrics';
import { parseRankedKeywords } from '@/lib/silo-builder/ranked-keywords';
import {
  assertSiloNodeAccess,
  isSiloAccessDeniedError,
} from '@/lib/silo-builder/security';
import { toNodeDto } from '@/lib/silo-builder/persist';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

type PatchBody = {
  title?: string;
  targetKeyword?: string;
  geography?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getAuthenticatedWorkspaceId();
    const { projectId } = await assertSiloNodeAccess(context.params.id, workspaceId);
    const prisma = getPrisma();

    const existing = await prisma.siloNode.findFirst({
      where: { id: context.params.id },
      include: { project: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const title = body.title?.trim() ?? existing.title;
    const targetKeyword = body.targetKeyword?.trim() ?? existing.targetKeyword;
    const keywordChanged =
      body.targetKeyword !== undefined &&
      body.targetKeyword.trim() !== (existing.targetKeyword ?? '');

    let searchVolume = existing.searchVolume;
    let difficulty = existing.difficulty;
    let originalTargetKeyword = existing.originalTargetKeyword;
    let keywordSource = existing.keywordSource;
    let metricsConfidence = existing.metricsConfidence;
    let resolvedTargetKeyword = targetKeyword;
    let enrichedAt = existing.enrichedAt;

    if (keywordChanged && targetKeyword) {
      const location = body.geography?.trim() || existing.project.geography || 'Malaysia';
      const rankedKeywords = parseRankedKeywords(existing.project.rankedKeywords);
      const meta = await enrichKeywordWithMetrics({
        rawKeyword: targetKeyword,
        location,
        workspaceId,
        competitorKeywords: rankedKeywords,
        keywordSourceOverride: 'manual',
      });

      resolvedTargetKeyword = meta.targetKeyword;
      searchVolume = meta.searchVolume;
      difficulty = meta.difficulty;
      originalTargetKeyword = meta.originalTargetKeyword;
      keywordSource = meta.keywordSource;
      metricsConfidence = meta.metricsConfidence;
      enrichedAt = new Date();
    }

    const updated = await prisma.siloNode.updateMany({
      where: { id: context.params.id, projectId },
      data: {
        title,
        targetKeyword: resolvedTargetKeyword,
        originalTargetKeyword: keywordChanged
          ? originalTargetKeyword
          : existing.originalTargetKeyword,
        keywordSource: keywordChanged ? keywordSource : existing.keywordSource,
        metricsConfidence: keywordChanged
          ? metricsConfidence
          : existing.metricsConfidence,
        searchVolume: keywordChanged ? searchVolume : existing.searchVolume,
        difficulty: keywordChanged ? difficulty : existing.difficulty,
        enrichedAt: keywordChanged ? enrichedAt : existing.enrichedAt,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Update failed' }, { status: 404 });
    }

    const node = await prisma.siloNode.findFirst({ where: { id: context.params.id } });
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    if (keywordChanged) {
      const allNodes = await prisma.siloNode.findMany({ where: { projectId } });
      await syncSiloProjectMetricsStatus(
        projectId,
        allNodes.map(toNodeDto),
        { enrichedAt: enrichedAt ?? new Date() }
      );
    }

    return NextResponse.json({ node: toNodeDto(node) });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

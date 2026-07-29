import { computeCitationShare } from '@/lib/ai-visibility/citation-eval';
import { resolveBrandFieldsForRow } from '@/lib/ai-visibility/aeo-brand-profile';
import type { AeoBrandProfileRecord } from '@/lib/ai-visibility/aeo-brand-profile';
import type { VisibilityRow, VisibilitySnapshot } from '@/lib/ai-visibility/types';
import {
  visibilityPromptToRow,
  visibilityRowToUpdateInput,
  visibilityRowToUpsertInput,
} from '@/lib/ai-visibility/visibility-mapper';
import { getPrisma } from '@/lib/prisma';

export async function listVisibilityRowsByProject(
  projectId: string
): Promise<VisibilityRow[]> {
  const records = await getPrisma().visibilityPrompt.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return records.map(visibilityPromptToRow);
}

export async function countActiveVisibilityRows(projectId: string): Promise<number> {
  return getPrisma().visibilityPrompt.count({
    where: { projectId, suspended: false },
  });
}

export async function getProjectVaultUpdatedAt(projectId: string): Promise<string> {
  const agg = await getPrisma().visibilityPrompt.aggregate({
    where: { projectId },
    _max: { updatedAt: true },
  });
  return agg._max.updatedAt?.toISOString() ?? new Date(0).toISOString();
}

export async function findVisibilityRowById(
  promptId: string
): Promise<VisibilityRow | null> {
  const record = await getPrisma().visibilityPrompt.findUnique({
    where: { id: promptId },
  });
  return record ? visibilityPromptToRow(record) : null;
}

export async function findVisibilityRowForWorkspace(
  promptId: string,
  workspaceId: string
): Promise<VisibilityRow | null> {
  const record = await getPrisma().visibilityPrompt.findFirst({
    where: {
      id: promptId,
      project: { workspaceId },
    },
  });
  return record ? visibilityPromptToRow(record) : null;
}

/** Resolve a row only when it belongs to the requested owned project. */
export async function findVisibilityRowForProject(
  promptId: string,
  projectId: string,
  workspaceId: string
): Promise<VisibilityRow | null> {
  const record = await getPrisma().visibilityPrompt.findFirst({
    where: {
      id: promptId,
      projectId,
      project: { workspaceId },
    },
  });
  return record ? visibilityPromptToRow(record) : null;
}

export async function upsertVisibilityRow(
  row: VisibilityRow,
  opts?: { prepend?: boolean }
): Promise<void> {
  const projectId = row.projectId?.trim();
  if (!projectId) {
    throw new Error('projectId is required to persist a visibility row.');
  }

  const prisma = getPrisma();
  const existing = await prisma.visibilityPrompt.findUnique({
    where: { id: row.promptId },
    select: { sortOrder: true },
  });

  let sortOrder = existing?.sortOrder ?? 0;
  if (!existing && opts?.prepend) {
    const min = await prisma.visibilityPrompt.aggregate({
      where: { projectId },
      _min: { sortOrder: true },
    });
    sortOrder = (min._min.sortOrder ?? 0) - 1;
  }

  if (existing) {
    await prisma.visibilityPrompt.update({
      where: { id: row.promptId },
      data: visibilityRowToUpdateInput(row),
    });
    return;
  }

  await prisma.visibilityPrompt.create({
    data: visibilityRowToUpsertInput(row, sortOrder),
  });
}

export async function insertVisibilityRowsPrepend(
  projectId: string,
  rows: VisibilityRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const prisma = getPrisma();
  await prisma.$transaction(async tx => {
    const min = await tx.visibilityPrompt.aggregate({
      where: { projectId },
      _min: { sortOrder: true },
    });
    let nextOrder = (min._min.sortOrder ?? 0) - rows.length;

    for (const row of rows) {
      await tx.visibilityPrompt.create({
        data: visibilityRowToUpsertInput({ ...row, projectId }, nextOrder++),
      });
    }
  });
}

export async function buildVisibilitySnapshot(
  projectId: string
): Promise<VisibilitySnapshot> {
  const rows = await listVisibilityRowsByProject(projectId);
  const active = rows.filter(r => !r.suspended);
  const activeEngines = 4;
  let top3 = 0;

  for (const row of active) {
    if (row.googleAio.kind === 'cited' && row.googleAio.rank <= 3) top3 += 1;
    if (row.perplexity.kind === 'cited' && row.perplexity.rank <= 3) top3 += 1;
    if (row.chatgpt.kind === 'inline_link' || row.chatgpt.kind === 'text_mention') {
      top3 += 1;
    }
    if (row.claude.kind === 'inline_link' || row.claude.kind === 'text_mention') {
      top3 += 1;
    }
  }

  const clusters = new Set(active.map(r => r.promptCluster));
  const share = computeCitationShare(top3, active.length, activeEngines);
  const competitorDelta = share - 0.28;
  const lastUpdatedAt = await getProjectVaultUpdatedAt(projectId);

  return {
    totalCitationShare: share,
    promptClustersTracked: clusters.size,
    top3CitationsSecured: top3,
    competitorDeltaShareOfVoice: competitorDelta,
    creditsUsed: 1842,
    creditsLimit: 5000,
    syncStatus: 'synced',
    lastUpdatedAt,
    deepScanEnabled: false,
    activeEngines,
    activeNonSuspendedPrompts: active.length,
  };
}

export async function listProjectPromptStrings(projectId: string): Promise<string[]> {
  const records = await getPrisma().visibilityPrompt.findMany({
    where: { projectId },
    select: { prompt: true },
  });
  return records.map(r => r.prompt);
}

export async function syncVisibilityPromptsFromBrandProfile(
  projectId: string,
  profile: Pick<AeoBrandProfileRecord, 'brandLabel' | 'primaryUrl' | 'brandAliases'>
): Promise<number> {
  const { userTargetUrl, brandAliases } = resolveBrandFieldsForRow(profile);
  const now = new Date();

  const result = await getPrisma().visibilityPrompt.updateMany({
    where: { projectId },
    data: {
      userTargetUrl,
      brandAliases,
      updatedAt: now,
      lastActionAt: now,
    },
  });

  return result.count;
}

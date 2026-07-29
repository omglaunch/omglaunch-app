import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { stampVisibilityRowBrand } from '@/lib/ai-visibility/aeo-brand-profile';
import { getAeoBrandProfile } from '@/app/actions/aeo-brand-profile';
import type { VisibilityRow } from '@/lib/ai-visibility/types';
import { normalizeClusterKey, normalizePromptString } from '@/lib/ai-visibility/onboarding/utils';
import { resolveCapacityCeiling } from '@/lib/ai-visibility/onboarding/capacity';
import type { OnboardingSource } from '@/lib/ai-visibility/onboarding/types';
import {
  countActiveVisibilityRows,
  getProjectVaultUpdatedAt,
  insertVisibilityRowsPrepend,
  listProjectPromptStrings,
} from '@/lib/ai-visibility/visibility-repository';
import {
  ProjectAccessError,
  ReadOnlyAccessError,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BulkItem = {
  id: string;
  prompt: string;
  cluster: string;
  geoLocationId: string;
  geoLabel: string;
  source: OnboardingSource;
};

/**
 * POST /api/ai-visibility/onboarding/bulk-create
 * Server-side hard capacity authorization + transactional persist to VisibilityPrompt.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompts?: BulkItem[];
      projectId?: string;
    };
    const prompts = body.prompts ?? [];
    const projectId = await requireAccessibleProjectWriteId(body.projectId);

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: 'No prompts provided' }, { status: 400 });
    }

    const brandProfile = await getAeoBrandProfile(projectId);
    if (!brandProfile) {
      return NextResponse.json(
        {
          error:
            'AEO brand profile is required for this project. Set client brand name and website before committing prompts.',
        },
        { status: 400 }
      );
    }

    const activeCount = await countActiveVisibilityRows(projectId);
    const remaining = resolveCapacityCeiling(100) - Math.min(activeCount, 100);
    if (prompts.length > remaining) {
      return NextResponse.json(
        {
          error: 'Server capacity check failed',
          remaining,
          message:
            'Capacity Reached. Please commit or clear rows before importing more.',
        },
        { status: 403 }
      );
    }

    const existingPrompts = await listProjectPromptStrings(projectId);
    const existingNorm = new Set(
      existingPrompts.map(prompt => normalizePromptString(prompt))
    );

    const clusterMap = new Map<string, string>();
    for (const p of prompts) {
      const key = normalizeClusterKey(p.cluster || 'Uncategorized');
      if (!clusterMap.has(key)) {
        clusterMap.set(key, `cluster_${key.replace(/\s+/g, '_').slice(0, 40)}`);
      }
    }

    let created = 0;
    let skippedDuplicates = 0;
    const promptIds: string[] = [];
    const createdRows: VisibilityRow[] = [];
    const now = new Date().toISOString();
    const baseIdx = activeCount;

    try {
      const rowsToInsert: VisibilityRow[] = [];

      for (let i = 0; i < prompts.length; i++) {
        const p = prompts[i]!;
        const norm = normalizePromptString(p.prompt);
        if (!norm) continue;
        if (existingNorm.has(norm)) {
          skippedDuplicates += 1;
          continue;
        }

        const clusterId = clusterMap.get(
          normalizeClusterKey(p.cluster || 'Uncategorized')
        )!;

        const baseRow: VisibilityRow = {
          promptId: p.id || `prompt_onboard_${baseIdx + i}`,
          projectId,
          prompt: p.prompt.trim(),
          promptCluster: p.cluster.trim() || 'Uncategorized',
          aiSearchVol: null,
          aiSearchVolConfirmed: false,
          organicRank: null,
          geoTarget: p.geoLabel,
          geoLocationId: p.geoLocationId,
          geoTimezone: 'America/New_York',
          userTargetUrl: brandProfile.primaryUrl,
          brandAliases: brandProfile.brandAliases,
          persistenceTrend: ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
          lastSyncedAt: now,
          lastActionAt: now,
          updatedAt: now,
          nextCronRun: null,
          googleAio: { kind: 'loading' },
          perplexity: { kind: 'loading' },
          chatgpt: { kind: 'loading' },
          claude: { kind: 'loading' },
          competitorThreat: { kind: 'loading' },
          rowSyncState: 'idle',
          deepScanEnabled: false,
          suspended: false,
        };

        const row = stampVisibilityRowBrand(baseRow, brandProfile, projectId);

        void clusterId;
        rowsToInsert.push(row);
        existingNorm.add(norm);
        promptIds.push(row.promptId);
        createdRows.push(row);
        created += 1;
      }

      await insertVisibilityRowsPrepend(projectId, rowsToInsert);

      revalidatePath('/ai-visibility');

      return NextResponse.json({
        created,
        skippedDuplicates,
        clusterIds: Array.from(clusterMap.values()),
        promptIds,
        rows: createdRows,
        lastUpdatedAt: await getProjectVaultUpdatedAt(projectId),
      });
    } catch (inner) {
      console.error('[bulk-create] transaction failed', inner);
      return NextResponse.json(
        { error: 'Commit failed — transaction rolled back' },
        { status: 500 }
      );
    }
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError || error instanceof ReadOnlyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Bulk create failed';
    console.error('[ai-visibility/onboarding/bulk-create] POST', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

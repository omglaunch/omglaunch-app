import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  findVisibilityRowForProject,
  getProjectVaultUpdatedAt,
  upsertVisibilityRow,
} from '@/lib/ai-visibility/visibility-repository';
import {
  previewLiveForceSyncCredits,
  runLiveForceSync,
} from '@/lib/ai-visibility/live-sync';
import { AI_VISIBILITY_CREDIT_PER_ENGINE } from '@/lib/ai-visibility/constants';
import {
  ProjectAccessError,
  ReadOnlyAccessError,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { deductCredits, isInsufficientCreditsError } from '@/lib/credits';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Manual Force Sync — live Perplexity / ChatGPT / Claude adapters.
 * Google AIO remains deferred (row value preserved).
 * Credits: 1 per engine when master (platform) keys are used.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkUserRateLimit(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = (await request.json()) as {
      promptId?: string;
      projectId?: string;
      deepScan?: boolean;
    };
    const promptId = body.promptId?.trim();
    if (!promptId) {
      return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const projectId = await requireAccessibleProjectWriteId(body.projectId);
      const row = await findVisibilityRowForProject(promptId, projectId, workspaceId);
      if (!row) {
        return NextResponse.json(
          { error: 'Prompt not found for this project' },
          { status: 404 }
        );
      }

      const syncingRow = {
        ...row,
        rowSyncState: 'background_syncing' as const,
        deepScanEnabled: body.deepScan ?? row.deepScanEnabled,
        lastActionAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await upsertVisibilityRow(syncingRow);

      const preview = await previewLiveForceSyncCredits(workspaceId);
      if (preview.creditsToCharge > 0) {
        await deductCredits(
          session.user!.id,
          preview.creditsToCharge,
          'AI_VISIBILITY_FORCE_SYNC'
        );
      }

      const result = await runLiveForceSync({
        workspaceId,
        row,
        deepScan: body.deepScan,
      });

      await upsertVisibilityRow(result.row);

      const parts: string[] = [];
      if (result.enginesSynced.length) {
        parts.push(`synced ${result.enginesSynced.join(', ')}`);
      }
      if (result.enginesMissingKey.length) {
        parts.push(`missing key: ${result.enginesMissingKey.join(', ')}`);
      }
      if (result.enginesFailed.length) {
        parts.push(`failed: ${result.enginesFailed.join(', ')}`);
      }
      if (preview.creditsToCharge > 0) {
        parts.push(
          `${preview.creditsToCharge} credit${preview.creditsToCharge === 1 ? '' : 's'} (${AI_VISIBILITY_CREDIT_PER_ENGINE}/engine)`
        );
      }

      return NextResponse.json({
        row: result.row,
        enginesSynced: result.enginesSynced,
        enginesFailed: result.enginesFailed,
        enginesMissingKey: result.enginesMissingKey,
        creditsCharged: preview.creditsToCharge,
        lastUpdatedAt: await getProjectVaultUpdatedAt(projectId),
        message:
          parts.length > 0
            ? `Force sync complete — ${parts.join('; ')}`
            : 'Force sync complete',
      });
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 }
      );
    }
    if (error instanceof ReadOnlyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[ai-visibility/force-sync] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to run force sync' },
      { status: 500 }
    );
  }
}

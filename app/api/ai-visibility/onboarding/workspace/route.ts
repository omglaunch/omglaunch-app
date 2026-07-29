import { NextResponse } from 'next/server';
import {
  FALLBACK_WORKSPACE_GEO,
  STAGING_HARD_CEILING,
  type WorkspaceTrackingSettings,
} from '@/lib/ai-visibility/onboarding/types';
import { countActiveVisibilityRows } from '@/lib/ai-visibility/visibility-repository';
import { ProjectAccessError, requireAccessibleProjectId } from '@/lib/projects/team-access';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Account-wide tracked-prompt cap (staging ceiling is min of this remaining + 100). */
const ACCOUNT_PROMPT_CAP = STAGING_HARD_CEILING;

/**
 * Workspace context hydration for cost calculator + default geo.
 * remainingAccountLimit = how many more prompts can enter the matrix before the 100 cap.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = await requireAccessibleProjectId(searchParams.get('projectId'));

    const tracked = await countActiveVisibilityRows(projectId);
    const remainingAccountLimit = Math.max(0, ACCOUNT_PROMPT_CAP - tracked);

    const settings: WorkspaceTrackingSettings = {
      remainingAccountLimit,
      activeDefaultEngines: 4,
      syncFrequencyMultiplier: 4.3,
      defaultGeo: FALLBACK_WORKSPACE_GEO,
      creditsPerEngineSync: 1,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[ai-visibility/onboarding/workspace] GET', error);
    const message =
      error instanceof Error ? error.message : 'Failed to load workspace tracking settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

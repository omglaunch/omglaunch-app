import { NextResponse } from 'next/server';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import {
  assertSiloProjectAccess,
  isSiloAccessDeniedError,
} from '@/lib/silo-builder/security';
import {
  enrichMissingSiloProjectMetrics,
  fetchProjectWithNodes,
  refreshSiloProjectMetrics,
} from '@/lib/silo-builder/persist';
import { isLabsBudgetExceededError } from '@/lib/silo-builder/labs-budget';
import { isEnrichInProgressError } from '@/lib/silo-builder/enrich-metrics';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

/**
 * POST body (optional JSON):
 * - mode: "missing" (default) — enrich only incomplete nodes
 * - mode: "all" — force refresh every keyword node (batched)
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    await assertSiloProjectAccess(context.params.id, workspaceId);

    let mode: 'missing' | 'all' = 'missing';
    try {
      const body = (await request.json()) as { mode?: string };
      if (body?.mode === 'all') {
        mode = 'all';
      }
    } catch {
      // Empty body → enrich missing only
    }

    if (mode === 'all') {
      await refreshSiloProjectMetrics(context.params.id, workspaceId);
    } else {
      await enrichMissingSiloProjectMetrics(context.params.id, workspaceId);
    }

    const project = await fetchProjectWithNodes(context.params.id, workspaceId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project, mode });
  } catch (error) {
    if (isSiloAccessDeniedError(error)) {
      const message = error instanceof Error ? error.message : 'Access denied';
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isEnrichInProgressError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (isLabsBudgetExceededError(error)) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : 'Refresh failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

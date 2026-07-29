import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { resolveAccessibleProjectFromSources } from '@/lib/projects/team-access';
import { executeGeogridRun } from '@/lib/local-dominance/execute-geogrid';
import {
  requireLocalDominanceProjectWriteId,
} from '@/lib/local-dominance/project-access';
import type { GeogridPlatform, GridSize } from '@/lib/local-dominance/types';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { assertIntegrationEnabled, IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { isInsufficientCreditsError } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

type GeogridRunBody = {
  projectId?: string;
  keyword?: string;
  centralLat?: number;
  centralLng?: number;
  radiusKm?: number;
  gridSize?: GridSize;
  platform?: GeogridPlatform;
  businessName?: string;
  businessCid?: string;
  scheduleRun?: boolean;
  scheduleFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dateRangeStart?: string;
  dateRangeEnd?: string;
};

function isValidBody(body: unknown): body is Required<
  Pick<GeogridRunBody, 'projectId' | 'keyword' | 'radiusKm' | 'gridSize'>
> &
  GeogridRunBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as GeogridRunBody;
  const hasValidManualGps =
    typeof b.centralLat === 'number' &&
    typeof b.centralLng === 'number' &&
    Number.isFinite(b.centralLat) &&
    Number.isFinite(b.centralLng);

  const hasAutoDetectSignals =
    Boolean(b.businessName?.trim()) || Boolean(b.keyword?.trim());

  return (
    typeof b.projectId === 'string' &&
    b.projectId.trim().length > 0 &&
    typeof b.keyword === 'string' &&
    b.keyword.trim().length > 0 &&
    typeof b.radiusKm === 'number' &&
    [3, 5, 7].includes(b.gridSize as number) &&
    (hasValidManualGps || hasAutoDetectSignals)
  );
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkUserRateLimit(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before running again.' },
        { status: 429 }
      );
    }

    const body: unknown = await request.json();
    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: 'projectId, keyword, radiusKm, and gridSize are required' },
        { status: 400 }
      );
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const projectId = await requireLocalDominanceProjectWriteId(body.projectId);

      try {
        await assertIntegrationEnabled('DATAFORSEO');
      } catch (error) {
        if (error instanceof IntegrationCircuitOpenError) {
          return NextResponse.json({ error: error.message }, { status: 503 });
        }
        throw error;
      }

      const result = await withIntegrationTelemetry(
        {
          workspaceId,
          integrationType: 'DATAFORSEO',
          targetUrl: 'serp/google/maps/live/advanced',
        },
        () =>
          executeGeogridRun(workspaceId, session.user!.id, {
            projectId,
            keyword: body.keyword.trim(),
            centralLat: body.centralLat,
            centralLng: body.centralLng,
            radiusKm: body.radiusKm,
            gridSize: body.gridSize,
            platform: body.platform ?? 'google',
            businessName: body.businessName,
            businessCid: body.businessCid,
            scheduleRun: body.scheduleRun,
            scheduleFrequency: body.scheduleFrequency,
            dateRangeStart: body.dateRangeStart,
            dateRangeEnd: body.dateRangeEnd,
          })
      );

      return NextResponse.json(result);
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    console.error('[local-dominance/geogrid/run]', error);
    return handleProjectScopedRouteError(error, 'Geogrid run failed');
  }
}

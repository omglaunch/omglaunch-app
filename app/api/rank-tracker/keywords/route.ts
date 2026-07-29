import { NextResponse } from 'next/server';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import {
  requireAccessibleProjectId,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { parseTrackingFrequency } from '@/lib/rank-tracker/dataforseo';
import {
  injectTrackedKeywords,
  listRankTrackerKeywordRows,
} from '@/lib/rank-tracker/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AddKeywordsBody = {
  projectId?: string;
  keywords?: string[];
  targetUrl?: string | null;
  tags?: string[];
  trackingFrequency?: string;
};

function parseAddKeywordsBody(body: unknown): AddKeywordsBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const candidate = body as AddKeywordsBody;
  const projectId = candidate.projectId?.trim();

  if (!projectId) {
    return null;
  }

  return { ...candidate, projectId };
}

export async function GET(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId')?.trim();

      if (!projectId) {
        return NextResponse.json(
          { error: 'projectId is required' },
          { status: 400 }
        );
      }

      const workspaceId = await requireWorkspaceId();
      await requireAccessibleProjectId(projectId);

      const keywords = await listRankTrackerKeywordRows(projectId, workspaceId);

      return NextResponse.json({ keywords });
    });
  } catch (error) {
    console.error('[rank-tracker/keywords] GET error:', error);
    return handleProjectScopedRouteError(error, 'Failed to load rank tracker keywords');
  }
}

export async function POST(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const parsed = parseAddKeywordsBody(body);
      if (!parsed?.projectId) {
        return NextResponse.json(
          { error: 'projectId is required' },
          { status: 400 }
        );
      }

      const keywords = (parsed.keywords ?? [])
        .map(keyword => keyword.trim())
        .filter(Boolean);

      if (keywords.length === 0) {
        return NextResponse.json(
          { error: 'At least one keyword is required' },
          { status: 400 }
        );
      }

      await requireAccessibleProjectWriteId(parsed.projectId);

      const injection = await injectTrackedKeywords(parsed.projectId, keywords, {
        targetUrl: parsed.targetUrl,
        tags: parsed.tags,
        trackingFrequency: parseTrackingFrequency(parsed.trackingFrequency),
      });

      return NextResponse.json({
        ok: true,
        inserted: injection.inserted,
        skipped: injection.skipped,
      });
    });
  } catch (error) {
    console.error('[rank-tracker/keywords] POST error:', error);
    return handleProjectScopedRouteError(error, 'Failed to add rank tracker keywords');
  }
}

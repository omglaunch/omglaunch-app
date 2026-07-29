import { NextResponse } from 'next/server';
import {
  getProjectVaultUpdatedAt,
  listVisibilityRowsByProject,
} from '@/lib/ai-visibility/visibility-repository';
import { pageFromRows, filterVisibilityRows } from '@/lib/ai-visibility/utils';
import { MATRIX_PAGE_SIZE } from '@/lib/ai-visibility/types';
import type {
  CitationStatusFilter,
  VisibilityFiltersState,
} from '@/lib/ai-visibility/types';
import { ProjectAccessError, requireAccessibleProjectId } from '@/lib/projects/team-access';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Chunked matrix endpoint for infinite query loading.
 * Serves persisted rows from VisibilityPrompt table.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = await requireAccessibleProjectId(searchParams.get('projectId'));
    const cursor = searchParams.get('cursor');
    const search = searchParams.get('search') ?? '';
    const promptCluster = searchParams.get('promptCluster') ?? 'all';
    const geoTarget = searchParams.get('geoTarget') ?? 'all';
    const citationStatus = (searchParams.get('citationStatus') ??
      'all') as CitationStatusFilter;
    const since = searchParams.get('since');

    const filters: VisibilityFiltersState = {
      search,
      promptCluster,
      engine: 'all',
      device: 'desktop',
      chatGptMode: 'live_web',
      geoTarget,
      citationStatus,
    };

    let rows = await listVisibilityRowsByProject(projectId);
    if (since) {
      const sinceTs = Date.parse(since);
      rows = rows.filter(r => Date.parse(r.updatedAt) > sinceTs);
    }
    rows = filterVisibilityRows(rows, filters);

    const lastUpdatedAt = await getProjectVaultUpdatedAt(projectId);
    const page = pageFromRows(rows, cursor, MATRIX_PAGE_SIZE, lastUpdatedAt);

    return NextResponse.json(page);
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load visibility matrix';
    console.error('[ai-visibility/matrix] GET error:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

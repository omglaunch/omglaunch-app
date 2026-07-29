import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { migrateLegacyWorkspaceData } from '@/lib/migration/legacy-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { total, migrated } = await migrateLegacyWorkspaceData(session.user.id);

    return NextResponse.json({
      success: true,
      total,
      migrated,
    });
  } catch (error) {
    console.error('[admin/migrate-data] POST error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to migrate legacy workspace data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

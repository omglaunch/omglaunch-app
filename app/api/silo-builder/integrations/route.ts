import { NextResponse } from 'next/server';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { getPrisma } from '@/lib/prisma';
import type { WordPressSiteOption } from '@/lib/silo-builder/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workspaceId = await getAuthenticatedWorkspaceId();
    const prisma = getPrisma();

    const integration = await prisma.integrationConfig.findFirst({
      where: { workspaceId },
      select: {
        id: true,
        wordpressSiteUrl: true,
      },
    });

    const sites: WordPressSiteOption[] = [];

    if (integration?.wordpressSiteUrl?.trim()) {
      sites.push({
        integrationId: integration.id,
        label: integration.wordpressSiteUrl.trim(),
        siteUrl: integration.wordpressSiteUrl.trim(),
      });
    }

    return NextResponse.json({ sites });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}

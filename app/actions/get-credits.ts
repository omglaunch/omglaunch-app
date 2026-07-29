'use server';

import { headers } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import {
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';

export async function getUserCredits(): Promise<{ credits: number } | null> {
  // Opt out of static caching (Next 13.5 equivalent to unstable_noStore).
  await headers();

  try {
    const userId = await getAuthenticatedWorkspaceId();
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    if (!user) {
      return null;
    }

    return { credits: user.credits };
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return null;
    }
    throw error;
  }
}

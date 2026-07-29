import { getPrisma } from '@/lib/prisma';
import { assertNotImpersonatingForGeneration } from '@/lib/admin/impersonation';

export const INSUFFICIENT_CREDITS_ERROR = 'INSUFFICIENT_CREDITS';

export function isInsufficientCreditsError(error: unknown): boolean {
  return error instanceof Error && error.message === INSUFFICIENT_CREDITS_ERROR;
}

/**
 * Atomically deducts credits and records an immutable usage log entry.
 * Throws INSUFFICIENT_CREDITS when the balance is too low.
 * Blocked while admin impersonation is active.
 */
export async function deductCredits(
  userId: string,
  cost: number,
  action: string
): Promise<void> {
  await assertNotImpersonatingForGeneration();

  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error('Cost must be a positive integer');
  }

  const prisma = getPrisma();

  await prisma.$transaction(async tx => {
    const updateResult = await tx.user.updateMany({
      where: {
        id: userId,
        credits: { gte: cost },
      },
      data: {
        credits: { decrement: cost },
      },
    });

    if (updateResult.count === 0) {
      throw new Error(INSUFFICIENT_CREDITS_ERROR);
    }

    await tx.usageLog.create({
      data: {
        userId,
        action,
        cost,
      },
    });
  });
}

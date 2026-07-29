import { getPrisma } from '@/lib/prisma';
import { processSiloNodeGeneration } from '@/lib/silo-builder/process-generation';

const STUCK_STATUSES = ['QUEUED', 'GENERATING'] as const;
const STUCK_THRESHOLD_MS = 2 * 60 * 1000;

export async function recoverStuckSiloNodes(
  projectId: string,
  workspaceId: string,
  userId: string
): Promise<number> {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckNodes = await prisma.siloNode.findMany({
    where: {
      projectId,
      status: { in: [...STUCK_STATUSES] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (stuckNodes.length === 0) {
    return 0;
  }

  let recovered = 0;

  for (const node of stuckNodes) {
    try {
      await prisma.siloNode.updateMany({
        where: { id: node.id, status: { in: [...STUCK_STATUSES] } },
        data: { status: 'DRAFT' },
      });

      await processSiloNodeGeneration(node.id, projectId, workspaceId, userId);
      recovered += 1;
    } catch (error) {
      console.error('[silo-builder] Failed to recover stuck node:', node.id, error);
      await prisma.siloNode.updateMany({
        where: { id: node.id },
        data: { status: 'FAILED' },
      });
    }
  }

  return recovered;
}

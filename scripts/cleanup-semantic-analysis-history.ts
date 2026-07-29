import { Prisma, PrismaClient } from '@prisma/client';
import {
  planSemanticHistoryCleanup,
  type SemanticHistoryCleanupResult,
  type SemanticHistoryRecord,
} from '../lib/tool-history/semantic-history-cleanup';

const prisma = new PrismaClient();

async function cleanupSemanticAnalysisHistory(): Promise<SemanticHistoryCleanupResult> {
  const records = (await prisma.semanticAnalysisHistory.findMany({
    orderBy: { updatedAt: 'desc' },
  })) as SemanticHistoryRecord[];

  const plans = planSemanticHistoryCleanup(records);
  let recordsDeleted = 0;
  let recordsUpdated = 0;

  for (const plan of plans) {
    await prisma.semanticAnalysisHistory.update({
      where: { id: plan.keepId },
      data: {
        identifier: plan.normalizedIdentifier,
        resultData: plan.mergedPayload as Prisma.InputJsonValue,
      },
    });
    recordsUpdated += 1;

    if (plan.deleteIds.length > 0) {
      const deleted = await prisma.semanticAnalysisHistory.deleteMany({
        where: { id: { in: plan.deleteIds } },
      });
      recordsDeleted += deleted.count;
    }
  }

  const duplicateGroups = plans.filter(plan => plan.deleteIds.length > 0).length;

  return {
    groupsProcessed: plans.length,
    duplicateGroups,
    recordsDeleted,
    recordsUpdated,
  };
}

async function main() {
  const result = await cleanupSemanticAnalysisHistory();

  console.log('Semantic analysis history cleanup complete.');
  console.log(`Groups processed: ${result.groupsProcessed}`);
  console.log(`Duplicate groups merged: ${result.duplicateGroups}`);
  console.log(`Records updated: ${result.recordsUpdated}`);
  console.log(`Duplicate records deleted: ${result.recordsDeleted}`);
}

main()
  .catch(error => {
    console.error('Semantic analysis history cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

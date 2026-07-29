import { getPrisma } from '@/lib/prisma';
import { DEFAULT_WORKSPACE_ID } from '@/lib/projects/constants';

type MigratableDelegate = {
  updateMany: (args: {
    where: { workspaceId: string };
    data: { workspaceId: string };
  }) => Promise<{ count: number }>;
  count: (args: { where: { workspaceId: string } }) => Promise<number>;
};

const MIGRATABLE_TABLES: Array<{ key: string; getDelegate: () => MigratableDelegate }> = [
  { key: 'projects', getDelegate: () => getPrisma().project },
  { key: 'savedKeywords', getDelegate: () => getPrisma().savedKeyword },
  { key: 'seoAnalysisHistory', getDelegate: () => getPrisma().seoAnalysisHistory },
  { key: 'semanticAnalysisHistory', getDelegate: () => getPrisma().semanticAnalysisHistory },
  { key: 'analysisAIHistory', getDelegate: () => getPrisma().analysisAIHistory },
  { key: 'competitorCompareHistory', getDelegate: () => getPrisma().competitorCompareHistory },
  { key: 'pageAuditHistory', getDelegate: () => getPrisma().pageAuditHistory },
  { key: 'hubSpokeHistory', getDelegate: () => getPrisma().hubSpokeHistory },
  { key: 'articleStudioHistory', getDelegate: () => getPrisma().articleStudioHistory },
  { key: 'queryComparisonHistory', getDelegate: () => getPrisma().queryComparisonHistory },
  { key: 'keywordAuditHistory', getDelegate: () => getPrisma().keywordAuditHistory },
  { key: 'researchVolumesHistory', getDelegate: () => getPrisma().researchVolumesHistory },
  { key: 'suggestedKeywordsHistory', getDelegate: () => getPrisma().suggestedKeywordsHistory },
  { key: 'rankTrackerSnapshotHistory', getDelegate: () => getPrisma().rankTrackerSnapshotHistory },
  { key: 'aiContentWriterHistory', getDelegate: () => getPrisma().aIContentWriterHistory },
  { key: 'cmsPublishingHistory', getDelegate: () => getPrisma().cMSPublishingHistory },
];

export async function countLegacyWorkspaceRecords(): Promise<number> {
  let total = 0;

  for (const table of MIGRATABLE_TABLES) {
    try {
      total += await table.getDelegate().count({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
      });
    } catch {
      // Table may not exist yet in older schemas — treat as empty.
    }
  }

  return total;
}

export async function migrateLegacyWorkspaceData(
  targetWorkspaceId: string
): Promise<{ total: number; migrated: Record<string, number> }> {
  const migrated: Record<string, number> = {};

  for (const table of MIGRATABLE_TABLES) {
    try {
      const result = await table.getDelegate().updateMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
        data: { workspaceId: targetWorkspaceId },
      });
      migrated[table.key] = result.count;
    } catch {
      migrated[table.key] = 0;
    }
  }

  const total = Object.values(migrated).reduce((sum, count) => sum + count, 0);
  return { total, migrated };
}

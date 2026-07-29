import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { evaluateGEO } from '@/lib/ai';
import { requireWorkspaceId } from '@/lib/projects/workspace-scope';
import { prisma } from '@/lib/prisma';
import { scrapePageData } from '@/lib/scraper';

export type SavePageAuditInput = {
  url: string;
  targetKeyword: string;
  workspaceId?: string;
};

export async function savePageAudit(data: SavePageAuditInput) {
  const workspaceId = requireWorkspaceId(data.workspaceId);

  const scraped = await scrapePageData(data.url);
  const evaluation = await evaluateGEO(scraped, data.targetKeyword);

  const auditData: Prisma.InputJsonValue = {
    title: scraped.title,
    headings: scraped.headings,
    wordCount: scraped.wordCount,
    images: scraped.images,
    targetKeyword: data.targetKeyword,
    analysis: evaluation.analysis,
    actionPlan: evaluation.actionPlan,
    bonusTip: evaluation.bonusTip,
  };

  const geoScore = evaluation.geoScore;

  const audit = await prisma.pageAudit.create({
    data: {
      url: data.url,
      targetKeyword: data.targetKeyword,
      geoScore,
      auditData,
    },
  });

  await prisma.pageAuditHistory.create({
    data: {
      workspaceId,
      identifier: data.url,
      resultData: {
        legacyAuditId: audit.id,
        url: audit.url,
        targetKeyword: audit.targetKeyword,
        geoScore: audit.geoScore,
        auditData,
        projectId: workspaceId,
      },
    },
  });

  revalidatePath('/page-audit');
  return audit;
}

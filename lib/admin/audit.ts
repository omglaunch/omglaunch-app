import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function logAdminAction(params: {
  adminId: string;
  actionType: string;
  targetResource: string;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
}) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: params.adminId,
      actionType: params.actionType,
      targetResource: params.targetResource,
      previousState: params.previousState ?? undefined,
      newState: params.newState ?? undefined,
    },
  });
}

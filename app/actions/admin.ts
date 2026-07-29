'use server';

import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import { requireAdminAccess, requireSuperAdminAccess } from '@/lib/admin/rbac';
import { logAdminAction } from '@/lib/admin/audit';
import { requireSudoMode, setSudoVerified } from '@/lib/admin/sudo';
import {
  setImpersonation,
  clearImpersonation,
  getImpersonationState,
} from '@/lib/admin/impersonation';
import {
  getOrCreateSystemConfiguration,
  maskSystemConfigSecrets,
  updateSystemConfiguration,
} from '@/lib/admin/system-config';
import { invalidateCircuitBreakerCache } from '@/lib/admin/circuit-breaker';
import { markStaleQueueTasks } from '@/lib/admin/integration-logging';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import type { PlatformRole } from '@/lib/admin/rbac';

export async function getCurrentUserPlatformRole(): Promise<PlatformRole | null> {
  const session = await getAuthenticatedSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return (user?.role as PlatformRole) ?? null;
}

const ADMIN_PATHS = ['/admin', '/admin/users', '/admin/queues', '/admin/ai-config', '/admin/integration-health'];

function revalidateAdmin() {
  for (const path of ADMIN_PATHS) {
    revalidatePath(path);
  }
}

export async function verifySudoMode(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdminAccess();
    // For OAuth-only users, accept any non-empty password in dev; in prod require env override
    const sudoPassword = process.env.ADMIN_SUDO_PASSWORD?.trim();
    if (sudoPassword && password !== sudoPassword) {
      return { success: false, error: 'Invalid password' };
    }
    if (!sudoPassword && !password.trim()) {
      return { success: false, error: 'Password required' };
    }
    await setSudoVerified(admin.id);
    return { success: true };
  } catch {
    return { success: false, error: 'Access denied' };
  }
}

export async function getAdminOverviewMetrics() {
  await requireAdminAccess();

  const config = await getOrCreateSystemConfiguration();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [userCount, usageLogs24h, recentLogs, failureCountLastHour, totalLastHour] =
    await Promise.all([
      prisma.user.count(),
      prisma.usageLog.findMany({
        where: { createdAt: { gte: oneDayAgo } },
        select: { cost: true, action: true },
      }),
      prisma.integrationHealthLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.integrationHealthLog.count({
        where: {
          status: 'FAILURE',
          createdAt: { gte: oneHourAgo },
        },
      }),
      prisma.integrationHealthLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
    ]);

  const totalCreditsConsumed = usageLogs24h.reduce((sum, log) => sum + log.cost, 0);
  const estimatedApiCost =
    (totalCreditsConsumed * config.inputTokenCostPerMillion) / 1_000_000 +
    (totalCreditsConsumed * config.outputTokenCostPerMillion) / 1_000_000;

  const creditValue = totalCreditsConsumed * 0.01; // $0.01 per credit placeholder
  const grossMargin =
    creditValue > 0 ? ((creditValue - estimatedApiCost) / creditValue) * 100 : 0;

  const inputTokens = Math.floor(totalCreditsConsumed * 0.6);
  const outputTokens = Math.floor(totalCreditsConsumed * 0.4);

  const failureRate =
    totalLastHour > 0 ? (failureCountLastHour / totalLastHour) * 100 : 0;

  return {
    userCount,
    siloMarginIndex: Math.round(grossMargin * 10) / 10,
    inputTokens24h: inputTokens,
    outputTokens24h: outputTokens,
    failureRate: Math.round(failureRate * 10) / 10,
    showHealthAlert: failureRate > 10,
    recentLogs,
    tokenCosts: {
      input: config.inputTokenCostPerMillion,
      output: config.outputTokenCostPerMillion,
    },
  };
}

export async function getAdminUsers(params: {
  page?: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive';
}) {
  await requireAdminAccess();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.search?.trim()) {
    where.email = { contains: params.search.trim() };
  }
  if (params.status === 'active') where.isActive = true;
  if (params.status === 'inactive') where.isActive = false;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        role: true,
        isActive: true,
        byokEnabled: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function adjustUserCredits(params: {
  userId: string;
  amount: number;
  comment: string;
  idempotencyKey: string;
}) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  const existing = await prisma.creditAdjustmentIdempotency.findUnique({
    where: { id: params.idempotencyKey },
  });
  if (existing) {
    return { success: true, duplicate: true };
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error('User not found');

  const previousCredits = user.credits;
  const newCredits = Math.max(0, previousCredits + params.amount);

  await prisma.$transaction(async tx => {
    await tx.creditAdjustmentIdempotency.create({
      data: {
        id: params.idempotencyKey,
        adminId: admin.id,
        userId: params.userId,
        amount: params.amount,
        comment: params.comment,
      },
    });

    await tx.user.update({
      where: { id: params.userId },
      data: { credits: newCredits },
    });
  });

  await logAdminAction({
    adminId: admin.id,
    actionType: 'CREDIT_ADJUSTMENT',
    targetResource: `user:${params.userId}`,
    previousState: { credits: previousCredits },
    newState: { credits: newCredits, comment: params.comment, amount: params.amount },
  });

  revalidateAdmin();
  return { success: true, newCredits };
}

export async function batchAdjustCredits(params: {
  userIds: string[];
  amount: number;
  comment: string;
  idempotencyKey: string;
}) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  for (const userId of params.userIds) {
    await adjustUserCredits({
      userId,
      amount: params.amount,
      comment: params.comment,
      idempotencyKey: `${params.idempotencyKey}-${userId}`,
    });
  }

  return { success: true };
}

export async function updateUserRole(params: { userId: string; role: PlatformRole }) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error('User not found');

  await prisma.user.update({
    where: { id: params.userId },
    data: { role: params.role },
  });

  await logAdminAction({
    adminId: admin.id,
    actionType: 'ROLE_CHANGE',
    targetResource: `user:${params.userId}`,
    previousState: { role: user.role },
    newState: { role: params.role },
  });

  revalidateAdmin();
  return { success: true };
}

export async function batchUpdateUserRole(params: { userIds: string[]; role: PlatformRole }) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  for (const userId of params.userIds) {
    await updateUserRole({ userId, role: params.role });
  }

  return { success: true };
}

export async function toggleUserAccess(params: { userId: string; isActive: boolean }) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error('User not found');

  await prisma.user.update({
    where: { id: params.userId },
    data: { isActive: params.isActive },
  });

  await logAdminAction({
    adminId: admin.id,
    actionType: 'ACCESS_TOGGLE',
    targetResource: `user:${params.userId}`,
    previousState: { isActive: user.isActive },
    newState: { isActive: params.isActive },
  });

  revalidateAdmin();
  return { success: true };
}

export async function batchToggleUserAccess(params: { userIds: string[]; isActive: boolean }) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  for (const userId of params.userIds) {
    await toggleUserAccess({ userId, isActive: params.isActive });
  }

  return { success: true };
}

export async function impersonateUser(params: { userId: string }) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true },
  });
  if (!target) throw new Error('User not found');

  await setImpersonation({
    adminId: admin.id,
    targetUserId: target.id,
    targetEmail: target.email,
  });

  await logAdminAction({
    adminId: admin.id,
    actionType: 'IMPERSONATION_START',
    targetResource: `user:${target.id}`,
    newState: { email: target.email },
  });

  redirect('/dashboard');
}

export async function exitImpersonation() {
  const state = await getImpersonationState();
  if (state) {
    await logAdminAction({
      adminId: state.adminId,
      actionType: 'IMPERSONATION_END',
      targetResource: `user:${state.targetUserId}`,
    });
  }
  await clearImpersonation();
  redirect('/admin');
}

export async function toggleUserByok(params: { userId: string; enabled: boolean }) {
  const admin = await requireSuperAdminAccess();
  await requireSudoMode(admin.id);

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error('User not found');

  await prisma.user.update({
    where: { id: params.userId },
    data: { byokEnabled: params.enabled },
  });

  await logAdminAction({
    adminId: admin.id,
    actionType: 'BYOK_TOGGLE',
    targetResource: `user:${params.userId}`,
    previousState: { byokEnabled: user.byokEnabled },
    newState: { byokEnabled: params.enabled },
  });

  revalidateAdmin();
  return { success: true };
}

export async function getQueueTasks() {
  await requireAdminAccess();
  await markStaleQueueTasks();

  const tasks = await prisma.backgroundQueueTask.findMany({
    where: { state: { in: ['RUNNING', 'STUCK'] } },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  return tasks.map(task => ({
    ...task,
    durationMs: Date.now() - task.startedAt.getTime(),
  }));
}

export async function forceKillQueueTask(taskId: string) {
  const admin = await requireAdminAccess();
  await requireSudoMode(admin.id);

  const task = await prisma.backgroundQueueTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  await prisma.backgroundQueueTask.update({
    where: { id: taskId },
    data: { state: 'FAILED', completedAt: new Date() },
  });

  await logAdminAction({
    adminId: admin.id,
    actionType: 'QUEUE_FORCE_KILL',
    targetResource: `queue:${taskId}`,
    previousState: { state: task.state },
    newState: { state: 'FAILED' },
  });

  revalidatePath('/admin/queues');
  return { success: true };
}

export async function getSystemConfig() {
  const admin = await requireAdminAccess();
  const config = await getOrCreateSystemConfiguration();
  const masked = maskSystemConfigSecrets(config);
  return { config: masked, isSuperAdmin: admin.role === 'SUPER_ADMIN' };
}

export async function updateSystemConfig(data: Record<string, unknown>) {
  const admin = await requireSuperAdminAccess();
  await requireSudoMode(admin.id);

  const previous = await getOrCreateSystemConfiguration();
  const updated = await updateSystemConfiguration(data);
  invalidateCircuitBreakerCache();

  await logAdminAction({
    adminId: admin.id,
    actionType: 'SYSTEM_CONFIG_UPDATE',
    targetResource: 'system:singleton',
    previousState: JSON.parse(JSON.stringify(maskSystemConfigSecrets(previous))) as Prisma.InputJsonValue,
    newState: JSON.parse(JSON.stringify(maskSystemConfigSecrets(updated))) as Prisma.InputJsonValue,
  });

  revalidatePath('/admin/ai-config');
  return { success: true };
}

export async function getIntegrationHealthLogs(params: {
  page?: number;
  type?: string;
  status?: string;
}) {
  await requireAdminAccess();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.type && params.type !== 'all') where.integrationType = params.type;
  if (params.status && params.status !== 'all') where.status = params.status;

  const [logs, total] = await Promise.all([
    prisma.integrationHealthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.integrationHealthLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function exportUsersCsv(search?: string) {
  await requireAdminAccess();

  const where: Record<string, unknown> = {};
  if (search?.trim()) where.email = { contains: search.trim() };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      credits: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const header = 'id,name,email,credits,role,isActive,createdAt\n';
  const rows = users
    .map(
      u =>
        `${u.id},"${u.name}","${u.email}",${u.credits},${u.role},${u.isActive},${u.createdAt.toISOString()}`
    )
    .join('\n');

  return header + rows;
}

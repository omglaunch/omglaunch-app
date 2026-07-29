import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { executeGeogridRun } from '@/lib/local-dominance/execute-geogrid';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { SOLV_ANOMALY_THRESHOLD } from '@/lib/local-dominance/constants';
import type { GridSize } from '@/lib/local-dominance/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function verifyCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  if (authorization === `Bearer ${secret}`) return true;

  const cronSignature = request.headers.get('x-cron-signature');
  return cronSignature === secret;
}

function computeNextRunAt(frequency: string, from: Date): Date {
  const next = new Date(from);
  if (frequency === 'DAILY') next.setDate(next.getDate() + 1);
  else if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + 7);
  return next;
}

export async function GET(request: Request) {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withBackgroundTask(
    {
      userId: 'system:cron',
      taskType: 'GEOGRID_CRON',
      metadata: { source: 'cron/geogrid' },
    },
    async () => {
      const now = new Date();
      const dueSchedules = await getPrisma().cronSchedule.findMany({
        where: {
          isActive: true,
          scheduleType: 'GEOGRID',
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
        },
      });

      const results: Array<{ scheduleId: string; status: string; anomaly?: boolean }> = [];

      for (const schedule of dueSchedules) {
        try {
          const result = await executeGeogridRun(schedule.workspaceId, schedule.workspaceId, {
            projectId: schedule.projectId,
            keyword: schedule.keyword,
            centralLat: schedule.centralLat,
            centralLng: schedule.centralLng,
            radiusKm: schedule.radiusKm,
            gridSize: schedule.gridSize as GridSize,
            platform: schedule.platform as 'google' | 'bing',
            businessName: schedule.businessName ?? undefined,
            businessCid: schedule.businessCid ?? undefined,
          }, { skipCreditDeduction: true });

          const anomaly =
            schedule.lastSolvScore != null &&
            result.solvScore < schedule.lastSolvScore * (1 - SOLV_ANOMALY_THRESHOLD);

          await getPrisma().cronSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunAt: now,
              nextRunAt: computeNextRunAt(schedule.frequency, now),
              lastSolvScore: result.solvScore,
            },
          });

          results.push({
            scheduleId: schedule.id,
            status: 'completed',
            anomaly: anomaly || undefined,
          });

          if (anomaly) {
            console.warn(
              `[cron/geogrid] SoLV anomaly for schedule ${schedule.id}: ${schedule.lastSolvScore}% → ${result.solvScore}%`
            );
          }
        } catch (error) {
          console.error(`[cron/geogrid] Failed schedule ${schedule.id}:`, error);
          results.push({ scheduleId: schedule.id, status: 'failed' });
        }
      }

      return NextResponse.json({
        ok: true,
        processed: results.length,
        results,
        completedAt: new Date().toISOString(),
      });
    }
  );
}

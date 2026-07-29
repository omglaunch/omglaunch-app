import { NextResponse } from 'next/server';
import { chunkArray } from '@/lib/rank-tracker/batch';
import {
  DATAFORSEO_TASK_CREATED,
  getDataForSeoCredentials,
  postOrganicTasks,
  requireDataForSeoWebhookSecret,
  type DataForSeoTaskPostItem,
  type DataForSeoTaskPostResponse,
} from '@/lib/rank-tracker/dataforseo';
import { computeNextCheckAt, isTrackingFrequency } from '@/lib/rank-tracker/scheduling';
import { prisma } from '@/lib/prisma';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { assertIntegrationEnabled, IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_SIZE = 100;
const DEFAULT_LOCATION_CODE = 2458;
const DEFAULT_LANGUAGE_CODE = 'en';

type DueKeyword = {
  id: string;
  keyword: string;
  trackingFrequency: string;
  locationCode: number | null;
  languageCode: string | null;
  device: string;
};

function verifyCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[cron/rank-tracker] CRON_SECRET is not configured');
    return false;
  }

  const authorization = request.headers.get('authorization');
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  const cronSignature = request.headers.get('x-cron-signature');
  if (cronSignature === secret) {
    return true;
  }

  return false;
}

function resolveAppBaseUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.RANK_TRACKER_PUBLIC_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (!baseUrl) {
    throw new Error(
      'Public app URL is not configured. Set NEXT_PUBLIC_APP_URL or RANK_TRACKER_PUBLIC_URL.'
    );
  }

  return baseUrl.replace(/\/+$/, '');
}

function buildCronPostbackUrl(baseUrl: string, webhookSecret: string): string {
  const token = encodeURIComponent(webhookSecret);
  return `${baseUrl}/api/rank-tracker/webhook?token=${token}&id=$id&tag=$tag`;
}

function buildCronTaskPayload(
  keywords: DueKeyword[],
  postbackUrl: string
): DataForSeoTaskPostItem[] {
  return keywords.map(keyword => ({
    keyword: keyword.keyword,
    location_code:
      typeof keyword.locationCode === 'number' && Number.isFinite(keyword.locationCode)
        ? Math.trunc(keyword.locationCode)
        : DEFAULT_LOCATION_CODE,
    language_code: keyword.languageCode?.trim() || DEFAULT_LANGUAGE_CODE,
    device: keyword.device.trim().toLowerCase() === 'mobile' ? 'mobile' : 'desktop',
    depth: 100,
    tag: keyword.id,
    postback_url: postbackUrl,
    postback_data: 'advanced',
    priority: 1,
  }));
}

function extractDataForSeoErrors(response: DataForSeoTaskPostResponse): string[] {
  const errors: string[] = [];

  if (response.status_code && response.status_code !== 20000 && response.status_message) {
    errors.push(response.status_message);
  }

  for (const task of response.tasks ?? []) {
    if (task.status_code === DATAFORSEO_TASK_CREATED) continue;
    if (task.status_message) {
      errors.push(task.status_message);
    }
  }

  return errors;
}

function resolveQueuedKeywordIds(
  batch: DueKeyword[],
  response: DataForSeoTaskPostResponse
): string[] {
  const queuedIds: string[] = [];

  for (const task of response.tasks ?? []) {
    if (task.status_code !== DATAFORSEO_TASK_CREATED) continue;
    const tag = task.data?.tag?.trim();
    if (tag) queuedIds.push(tag);
  }

  if ((response.tasks ?? []).length === 0) {
    queuedIds.push(...batch.map(keyword => keyword.id));
  }

  return Array.from(new Set(queuedIds));
}

async function advanceScheduleForKeywords(
  keywords: DueKeyword[],
  from: Date
): Promise<void> {
  await Promise.all(
    keywords.map(keyword => {
      const frequency = isTrackingFrequency(keyword.trackingFrequency)
        ? keyword.trackingFrequency
        : 'WEEKLY';

      return prisma.savedKeyword.update({
        where: { id: keyword.id },
        data: {
          nextCheckAt: computeNextCheckAt(frequency, from),
        },
      });
    })
  );
}

export async function GET(request: Request) {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await withBackgroundTask(
      {
        userId: 'system:cron',
        taskType: 'RANK_TRACKER_CRON',
        metadata: { source: 'cron/rank-tracker' },
      },
      async () => {
        await assertIntegrationEnabled('DATAFORSEO');
        return runRankTrackerCron();
      }
    );
  } catch (error) {
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

async function runRankTrackerCron() {
  const runStartedAt = new Date();
  let successfulBatches = 0;
  let failedBatches = 0;
  let totalKeywordsProcessed = 0;
  const batchErrors: string[] = [];

  try {
    const credentials = getDataForSeoCredentials();
    if (!credentials) {
      return NextResponse.json(
        {
          error:
            'DataForSEO credentials are not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
        },
        { status: 503 }
      );
    }

    let webhookSecret: string;
    try {
      webhookSecret = requireDataForSeoWebhookSecret();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Webhook secret is not configured in environment variables.';
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const now = new Date();
    const dueKeywords = await prisma.savedKeyword.findMany({
      where: {
        isActive: true,
        searchEngine: { in: ['google', 'google_organic'] },
        OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
      },
      select: {
        id: true,
        keyword: true,
        trackingFrequency: true,
        locationCode: true,
        languageCode: true,
        device: true,
      },
      orderBy: { nextCheckAt: 'asc' },
    });

    if (dueKeywords.length === 0) {
      return NextResponse.json(
        { message: 'No keywords currently due for tracking.' },
        { status: 200 }
      );
    }

    const baseUrl = resolveAppBaseUrl();
    const postbackUrl = buildCronPostbackUrl(baseUrl, webhookSecret);
    const chunks = chunkArray(dueKeywords, BATCH_SIZE);

    console.info(
      `[cron/rank-tracker] Starting run: ${dueKeywords.length} keyword(s) in ${chunks.length} batch(es).`
    );

    for (let index = 0; index < chunks.length; index += 1) {
      const batch = chunks[index];
      const payload = buildCronTaskPayload(batch, postbackUrl);

      try {
        const response = await postOrganicTasks(payload, credentials, {
          workspaceId: 'system:cron',
        });
        const apiErrors = extractDataForSeoErrors(response);

        if (response.status_code && response.status_code !== 20000) {
          failedBatches += 1;
          const message =
            apiErrors[0] ??
            response.status_message ??
            `DataForSEO returned status ${response.status_code}`;
          batchErrors.push(`Batch ${index + 1}: ${message}`);
          console.error('[cron/rank-tracker] DataForSEO batch rejected:', {
            batch: index + 1,
            status_code: response.status_code,
            status_message: response.status_message,
            task_errors: apiErrors,
          });
          continue;
        }

        if (apiErrors.length > 0) {
          failedBatches += 1;
          batchErrors.push(`Batch ${index + 1}: ${apiErrors.join('; ')}`);
          console.error('[cron/rank-tracker] DataForSEO task errors:', {
            batch: index + 1,
            task_errors: apiErrors,
          });
          continue;
        }

        const queuedIds = resolveQueuedKeywordIds(batch, response);
        const scheduledKeywords = batch.filter(keyword => queuedIds.includes(keyword.id));

        if (scheduledKeywords.length === 0) {
          failedBatches += 1;
          batchErrors.push(`Batch ${index + 1}: No tasks were queued by DataForSEO.`);
          continue;
        }

        await advanceScheduleForKeywords(scheduledKeywords, runStartedAt);

        successfulBatches += 1;
        totalKeywordsProcessed += scheduledKeywords.length;

        console.info(
          `[cron/rank-tracker] Batch ${index + 1} queued ${scheduledKeywords.length} keyword(s).`
        );
      } catch (error) {
        failedBatches += 1;
        const message =
          error instanceof Error ? error.message : 'DataForSEO request failed';
        batchErrors.push(`Batch ${index + 1}: ${message}`);
        console.error('[cron/rank-tracker] DataForSEO batch exception:', {
          batch: index + 1,
          error,
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Rank tracker cron run completed.',
        dueKeywords: dueKeywords.length,
        successfulBatches,
        failedBatches,
        totalKeywordsProcessed,
        postbackUrl: postbackUrl.replace(webhookSecret, '[REDACTED]'),
        errors: batchErrors.length > 0 ? batchErrors : undefined,
        completedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Rank tracker cron run failed';
    console.error('[cron/rank-tracker] Unhandled error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        successfulBatches,
        failedBatches,
        totalKeywordsProcessed,
        errors: batchErrors.length > 0 ? batchErrors : undefined,
      },
      { status: 500 }
    );
  }
}

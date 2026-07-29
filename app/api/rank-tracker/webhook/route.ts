import { gunzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';
import {
  parseSerpForTarget,
  resolveTargetDomain,
  type SerpItem,
} from '@/lib/rank-tracker/serp-parser';
import { stringifyCompetingPages } from '@/lib/rank-tracker/cannibalization';
import { UNRANKED_POSITION } from '@/lib/rank-tracker/types';
import { prisma } from '@/lib/prisma';
import { startLatencyTimer } from '@/lib/admin/integration-logging';
import { logInboundWebhook } from '@/lib/admin/integration-telemetry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DataForSeoTaskData =
  | {
      tag?: string;
      keyword?: string;
      [key: string]: unknown;
    }
  | Array<{
      tag?: string;
      keyword?: string;
      [key: string]: unknown;
    }>;

type DataForSeoWebhookTask = {
  id?: string;
  status_code?: number;
  status_message?: string;
  data?: DataForSeoTaskData;
  result?: Array<{
    items?: SerpItem[];
  }>;
};

type DataForSeoWebhookPayload = {
  tasks?: DataForSeoWebhookTask[];
};

function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.DATAFORSEO_WEBHOOK_SECRET;
  if (!expected) {
    console.error(
      '[rank-tracker/webhook] DATAFORSEO_WEBHOOK_SECRET is not configured'
    );
    return false;
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  return token === expected;
}

async function decodePostbackBody(request: Request): Promise<string> {
  const buffer = Buffer.from(await request.arrayBuffer());

  if (buffer.length === 0) {
    return '';
  }

  const contentEncoding = request.headers.get('content-encoding')?.toLowerCase();

  if (contentEncoding?.includes('gzip') || buffer[0] === 0x1f) {
    return gunzipSync(buffer).toString('utf-8');
  }

  return buffer.toString('utf-8');
}

function extractTagFromTaskData(data: DataForSeoTaskData | undefined): string | null {
  if (!data) {
    return null;
  }

  if (!Array.isArray(data)) {
    return data.tag?.trim() || null;
  }

  for (const entry of data) {
    const tag = entry?.tag?.trim();
    if (tag) {
      return tag;
    }
  }

  return null;
}

function resolveKeywordId(
  task: DataForSeoWebhookTask,
  request: Request
): string | null {
  const tagFromData = extractTagFromTaskData(task.data);
  if (tagFromData) {
    return tagFromData;
  }

  return new URL(request.url).searchParams.get('tag')?.trim() || null;
}

async function persistHistoryForTask(
  task: DataForSeoWebhookTask,
  request: Request
): Promise<{ savedKeywordId: string } | { error: string }> {
  if (task.status_code && task.status_code !== 20000) {
    return {
      error: task.status_message ?? `Task failed with code ${task.status_code}`,
    };
  }

  const savedKeywordId = resolveKeywordId(task, request);

  if (!savedKeywordId) {
    return { error: 'Missing keyword tag on completed task' };
  }

  const keyword = await prisma.savedKeyword.findUnique({
    where: { id: savedKeywordId },
    include: {
      project: {
        select: {
          domain: true,
        },
      },
    },
  });

  if (!keyword) {
    return { error: `Keyword ${savedKeywordId} not found` };
  }

  const competitorDomains: string[] = [];

  const items = task.result?.[0]?.items ?? [];
  const targetDomain = resolveTargetDomain(
    keyword.targetUrl,
    keyword.project.domain
  );

  const parsed = parseSerpForTarget(items, targetDomain, competitorDomains);

  const latestHistory = await prisma.rankTrackerHistory.findFirst({
    where: { savedKeywordId },
    orderBy: { checkedAt: 'desc' },
    select: { position: true },
  });

  const previousPosition = latestHistory?.position ?? UNRANKED_POSITION;
  const checkedAt = new Date();

  await prisma.rankTrackerHistory.create({
    data: {
      savedKeywordId,
      position: parsed.position,
      previousPosition,
      urlFound: parsed.rankedUrl,
      rankedUrl: parsed.rankedUrl || null,
      competingPages: stringifyCompetingPages(parsed.competingPages),
      isFeaturedSnippet: parsed.isFeaturedSnippet,
      isLocalPack: parsed.isLocalPack,
      serpFeaturesFound: parsed.serpFeaturesFound,
      competitorRankings: parsed.competitorRankings,
      checkedAt,
    },
  });

  await prisma.savedKeyword.update({
    where: { id: savedKeywordId },
    data: {
      currentRank: parsed.position >= UNRANKED_POSITION ? null : parsed.position,
      rankedUrl: parsed.rankedUrl || null,
      competingPages: stringifyCompetingPages(parsed.competingPages),
      lastTrackedAt: checkedAt,
    },
  });

  return { savedKeywordId };
}

export async function POST(request: Request) {
  const startedAt = startLatencyTimer();
  const targetUrl = new URL(request.url).pathname;

  try {
    if (!verifyWebhookSecret(request)) {
      console.warn(
        '[rank-tracker/webhook] Unauthorized: token parameter does not match DATAFORSEO_WEBHOOK_SECRET'
      );
      await logInboundWebhook({
        integrationType: 'WEBHOOK',
        targetUrl,
        startedAt,
        httpStatus: 401,
        success: false,
        errorMessage: 'Unauthorized webhook token',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await decodePostbackBody(request);

    if (!rawBody.trim()) {
      return NextResponse.json({ error: 'Empty postback body' }, { status: 400 });
    }

    let payload: DataForSeoWebhookPayload;

    try {
      payload = JSON.parse(rawBody) as DataForSeoWebhookPayload;
    } catch (error) {
      console.error('[rank-tracker/webhook] Failed to parse JSON body:', error);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const tasks = payload.tasks ?? [];
    const processed: string[] = [];
    const errors: string[] = [];

    for (const task of tasks) {
      try {
        const result = await persistHistoryForTask(task, request);
        if ('savedKeywordId' in result) {
          processed.push(result.savedKeywordId);
        } else {
          errors.push(result.error);
          console.error('[rank-tracker/webhook] Task error:', result.error);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to persist history';
        errors.push(message);
        console.error('[rank-tracker/webhook] Persist error:', error);
      }
    }

    const success = errors.length === 0;

    await logInboundWebhook({
      integrationType: 'DATAFORSEO',
      targetUrl,
      startedAt,
      httpStatus: success ? 200 : 207,
      success,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return NextResponse.json({
      ok: true,
      processed: processed.length,
      keywordIds: processed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[rank-tracker/webhook] Unhandled error:', error);

    await logInboundWebhook({
      integrationType: 'DATAFORSEO',
      targetUrl,
      startedAt,
      httpStatus: 500,
      success: false,
      errorMessage: message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

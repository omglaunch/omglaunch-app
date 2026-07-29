import { NextResponse } from 'next/server';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
  updateSavedKeywordInWorkspace,
} from '@/lib/projects/tenant-scope';
import { requireAccessibleProjectWriteId, isProjectAccessError } from '@/lib/projects/team-access';
import { handleProjectScopedRouteError } from '@/lib/projects/project-route-errors';
import { injectTrackedKeywords } from '@/lib/rank-tracker/server';
import { getProjectTrackingContext } from '@/lib/projects/tracking-context';
import {
  buildPostbackUrl,
  DATAFORSEO_TASK_CREATED,
  getDataForSeoCredentials,
  requireDataForSeoWebhookSecret,
  parseTrackingFrequency,
  postOrganicTasks,
  buildOrganicTaskPayload,
} from '@/lib/rank-tracker/dataforseo';
import { resolvePublicBaseUrl } from '@/lib/rank-tracker/public-url';
import { computeNextCheckAt, isTrackingFrequency } from '@/lib/rank-tracker/scheduling';
import { pollTaskAndRelayToWebhook } from '@/lib/rank-tracker/dev-postback-polling';
import type { TrackingFrequency } from '@/lib/rank-tracker/types';
import { prisma } from '@/lib/prisma';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_SIZE = 100;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

type TriggerRequestBody = {
  projectId?: string;
  keywords?: string[];
  targetUrl?: string | null;
  tags?: string[];
  trackingFrequency?: string;
  forceRefreshKeywordIds?: string[];
};

function parseTriggerBody(body: unknown): TriggerRequestBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const candidate = body as TriggerRequestBody;
  const projectId = candidate.projectId?.trim();

  if (!projectId) {
    return null;
  }

  return { ...candidate, projectId };
}

export async function POST(request: Request) {
  try {
    return await runWithAuthenticatedTenantScope(async () => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseTriggerBody(body);
    if (!parsed?.projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const workspaceId = await requireWorkspaceId();
    const projectId = parsed.projectId.trim();
    const trackingFrequency = parseTrackingFrequency(parsed.trackingFrequency);
    const forceRefreshKeywordIds = (parsed.forceRefreshKeywordIds ?? []).filter(
      id => typeof id === 'string' && id.trim()
    );
    const bypassCooldown = forceRefreshKeywordIds.length > 0;

    await requireAccessibleProjectWriteId(projectId);

    let injection = { inserted: 0, skipped: 0 };

    if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
      injection = await injectTrackedKeywords(projectId, parsed.keywords, {
        targetUrl: parsed.targetUrl,
        tags: parsed.tags,
        trackingFrequency,
      });
    }

    const project = await getProjectTrackingContext(projectId, workspaceId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.searchEngine !== 'google_organic') {
      return NextResponse.json(
        {
          error: 'Only google_organic projects are supported for rank tracking',
          injection,
        },
        { status: 400 }
      );
    }

    const credentials = getDataForSeoCredentials();
    if (!credentials) {
      return NextResponse.json(
        {
          error:
            'DataForSEO credentials are not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
          injection,
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
      return NextResponse.json({ error: message, injection }, { status: 503 });
    }

    const now = new Date();
    const cooldownSince = bypassCooldown
      ? null
      : new Date(now.getTime() - COOLDOWN_MS);

    const eligibleKeywords = await prisma.savedKeyword.findMany({
      where: {
        projectId,
        workspaceId,
        isActive: true,
        AND: [
          {
            OR: [
              { currentRank: null },
              { nextCheckAt: { lte: now } },
              { nextCheckAt: null },
              ...(forceRefreshKeywordIds.length > 0
                ? [{ id: { in: forceRefreshKeywordIds } }]
                : []),
            ],
          },
          ...(cooldownSince
            ? [
                {
                  OR: [
                    { currentRank: null },
                    { lastTrackedAt: null },
                    { lastTrackedAt: { lte: cooldownSince } },
                    ...(forceRefreshKeywordIds.length > 0
                      ? [{ id: { in: forceRefreshKeywordIds } }]
                      : []),
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        keyword: true,
        trackingFrequency: true,
        locationCode: true,
        languageCode: true,
      },
    });

    if (eligibleKeywords.length === 0) {
      const pendingFirstCheck = await prisma.savedKeyword.findFirst({
        where: {
          projectId,
          workspaceId,
          isActive: true,
          currentRank: null,
        },
        select: { id: true },
      });

      return NextResponse.json({
        ok: true,
        injection,
        queued: 0,
        cached: pendingFirstCheck ? undefined : true,
        message: pendingFirstCheck
          ? 'Keywords are waiting for their first rank check. Try again in a few minutes or use Force Refresh on selected rows.'
          : 'Rankings are already up to date (cached).',
      });
    }

    const baseUrl = resolvePublicBaseUrl(request);
    const postbackUrl = buildPostbackUrl(baseUrl, webhookSecret);
    const queuedKeywordIds: string[] = [];
    const taskErrors: string[] = [];
    const isDevelopment = process.env.NODE_ENV === 'development';
    const devRelayJobs: Array<{ taskId: string; tag?: string }> = [];

    for (let index = 0; index < eligibleKeywords.length; index += BATCH_SIZE) {
      const batch = eligibleKeywords.slice(index, index + BATCH_SIZE);
      const payload = buildOrganicTaskPayload(batch, project, postbackUrl);

      try {
        const response = await postOrganicTasks(payload, credentials, {
          workspaceId,
        });

        if (response.status_code && response.status_code !== 20000) {
          taskErrors.push(
            response.status_message ??
              `DataForSEO returned status ${response.status_code}`
          );
          continue;
        }

        for (const task of response.tasks ?? []) {
          if (task.status_code === DATAFORSEO_TASK_CREATED) {
            const tag = task.data?.tag;
            if (tag) {
              queuedKeywordIds.push(tag);
            }

            if (isDevelopment && task.id) {
              devRelayJobs.push({ taskId: task.id, tag });
            }
          } else if (task.status_message) {
            taskErrors.push(task.status_message);
          }
        }

        if ((response.tasks ?? []).length === 0) {
          queuedKeywordIds.push(...batch.map(keyword => keyword.id));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'DataForSEO request failed';
        console.error('[rank-tracker/trigger] DataForSEO batch error:', message);
        taskErrors.push(message);
      }
    }

    const uniqueQueuedIds = Array.from(new Set(queuedKeywordIds));
    const rescheduleFrom = new Date();

    if (uniqueQueuedIds.length > 0) {
      await Promise.all(
        uniqueQueuedIds.map(async savedKeywordId => {
          const keyword = eligibleKeywords.find(item => item.id === savedKeywordId);
          if (!keyword) return;

          const frequency = isTrackingFrequency(keyword.trackingFrequency)
            ? keyword.trackingFrequency
            : 'WEEKLY';

          await updateSavedKeywordInWorkspace(savedKeywordId, workspaceId, {
            nextCheckAt: computeNextCheckAt(frequency, rescheduleFrom),
          });
        })
      );
    }

    if (devRelayJobs.length > 0) {
      void withBackgroundTask(
        {
          userId: workspaceId,
          taskType: 'RANK_TRACKER_TRIGGER',
          metadata: {
            projectId,
            keywordCount: eligibleKeywords.length,
            devRelayCount: devRelayJobs.length,
          },
        },
        async () => {
          for (const job of devRelayJobs) {
            try {
              await pollTaskAndRelayToWebhook(
                job.taskId,
                credentials,
                webhookSecret,
                job.tag
              );
            } catch (error) {
              console.error(
                `[rank-tracker/trigger] Dev postback relay failed for task ${job.taskId}:`,
                error
              );
            }
          }
        }
      ).catch(error => {
        console.error('[rank-tracker/trigger] Background dev relay failed:', error);
      });
    }

    return NextResponse.json({
      ok: true,
      injection,
      queued: uniqueQueuedIds.length,
      postbackUrl: postbackUrl.replace(webhookSecret, '[REDACTED]'),
      devPostbackRelay: isDevelopment ? true : undefined,
      errors: taskErrors.length > 0 ? taskErrors : undefined,
    });
    });
  } catch (error) {
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message =
      error instanceof Error ? error.message : 'Rank tracker trigger failed';

    console.error('[rank-tracker/trigger] Unhandled error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

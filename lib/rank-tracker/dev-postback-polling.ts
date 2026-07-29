import {
  buildDataForSeoAuthHeader,
  type DataForSeoCredentials,
} from '@/lib/rank-tracker/dataforseo';

export const DATAFORSEO_TASK_GET_REGULAR_URL =
  'https://api.dataforseo.com/v3/serp/google/organic/task_get/regular';

export const DATAFORSEO_TASK_COMPLETE = 20000;

const DEV_POLL_INTERVAL_MS = 1500;
const DEV_POLL_MAX_ATTEMPTS = 20;

export type DataForSeoTaskGetResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: DataForSeoTaskGetTask[];
};

type DataForSeoTaskGetTask = {
  id?: string;
  status_code?: number;
  status_message?: string;
  data?: {
    tag?: string;
  };
  result?: unknown[];
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTaskReady(task: DataForSeoTaskGetTask): boolean {
  return (
    task.status_code === DATAFORSEO_TASK_COMPLETE &&
    Array.isArray(task.result) &&
    task.result.length > 0
  );
}

export async function fetchTaskResult(
  taskId: string,
  credentials: DataForSeoCredentials
): Promise<DataForSeoTaskGetResponse> {
  const response = await fetch(
    `${DATAFORSEO_TASK_GET_REGULAR_URL}/${taskId}`,
    {
      method: 'GET',
      headers: {
        Authorization: buildDataForSeoAuthHeader(credentials),
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(
      `DataForSEO task_get failed with HTTP ${response.status}: ${response.statusText}`
    );
  }

  return (await response.json()) as DataForSeoTaskGetResponse;
}

export async function pollTaskResult(
  taskId: string,
  credentials: DataForSeoCredentials
): Promise<DataForSeoTaskGetResponse> {
  let lastPayload: DataForSeoTaskGetResponse | null = null;

  for (let attempt = 1; attempt <= DEV_POLL_MAX_ATTEMPTS; attempt += 1) {
    const payload = await fetchTaskResult(taskId, credentials);
    lastPayload = payload;

    const task = payload.tasks?.[0];
    if (task && isTaskReady(task)) {
      return payload;
    }

    if (attempt < DEV_POLL_MAX_ATTEMPTS) {
      await sleep(DEV_POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    `DataForSEO task ${taskId} did not become ready after ${DEV_POLL_MAX_ATTEMPTS} attempts` +
      (lastPayload?.tasks?.[0]?.status_message
        ? `: ${lastPayload.tasks[0].status_message}`
        : '')
  );
}

export function resolveDevWebhookUrl(
  webhookSecret: string,
  keywordTag?: string
): string {
  const base =
    process.env.RANK_TRACKER_DEV_WEBHOOK_URL?.trim() ||
    `http://localhost:${process.env.PORT || '3000'}`;

  const url = `${base.replace(/\/+$/, '')}/api/rank-tracker/webhook?token=${encodeURIComponent(webhookSecret)}`;

  if (keywordTag?.trim()) {
    return `${url}&tag=${encodeURIComponent(keywordTag.trim())}`;
  }

  return url;
}

export async function forwardTaskPayloadToLocalWebhook(
  payload: DataForSeoTaskGetResponse,
  webhookSecret: string,
  keywordTag?: string
): Promise<void> {
  const tagFromPayload = payload.tasks?.[0]?.data?.tag?.trim();
  const webhookUrl = resolveDevWebhookUrl(
    webhookSecret,
    tagFromPayload || keywordTag
  );

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Local webhook relay failed with HTTP ${response.status}: ${body || response.statusText}`
    );
  }
}

export async function pollTaskAndRelayToWebhook(
  taskId: string,
  credentials: DataForSeoCredentials,
  webhookSecret: string,
  keywordTag?: string
): Promise<void> {
  const payload = await pollTaskResult(taskId, credentials);
  await forwardTaskPayloadToLocalWebhook(payload, webhookSecret, keywordTag);
}

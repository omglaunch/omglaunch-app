import type { ProjectTrackingContext } from '@/lib/projects/tracking-context';
import type { TrackingFrequency } from '@/lib/rank-tracker/types';
import { buildWebhookUrl } from '@/lib/rank-tracker/public-url';
import { withFetchTelemetry } from '@/lib/admin/integration-telemetry';

export const DATAFORSEO_ORGANIC_TASK_POST_URL =
  'https://api.dataforseo.com/v3/serp/google/organic/task_post';

export const DATAFORSEO_TASK_CREATED = 20100;

export type DataForSeoCredentials = {
  login: string;
  password: string;
};

export type RankTrackerKeywordRecord = {
  id: string;
  keyword: string;
  trackingFrequency: string;
  locationCode?: number | null;
  languageCode?: string | null;
};

export type DataForSeoTaskPostItem = {
  keyword: string;
  location_code: number;
  language_code: string;
  device: 'desktop' | 'mobile';
  depth: number;
  tag: string;
  postback_url: string;
  postback_data: 'advanced';
  priority: number;
};

export function getDataForSeoCredentials(): DataForSeoCredentials | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) {
    return null;
  }

  return { login, password };
}

export function getDataForSeoWebhookSecret(): string | null {
  return process.env.DATAFORSEO_WEBHOOK_SECRET?.trim() || null;
}

export function requireDataForSeoWebhookSecret(): string {
  const secret = getDataForSeoWebhookSecret();
  if (!secret) {
    throw new Error(
      'Webhook secret is not configured in environment variables.'
    );
  }
  return secret;
}

export function buildDataForSeoAuthHeader(
  credentials: DataForSeoCredentials
): string {
  return `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`;
}

export function buildOrganicTaskPayload(
  keywords: RankTrackerKeywordRecord[],
  project: ProjectTrackingContext,
  postbackUrl: string
): DataForSeoTaskPostItem[] {
  const device = project.deviceType === 'mobile' ? 'mobile' : 'desktop';

  return keywords.map(keyword => ({
    keyword: keyword.keyword,
    location_code: keyword.locationCode ?? project.locationCode,
    language_code: keyword.languageCode ?? project.languageCode,
    device,
    depth: 100,
    tag: keyword.id,
    postback_url: postbackUrl,
    postback_data: 'advanced',
    priority: 1,
  }));
}

export function buildPostbackUrl(baseUrl: string, token: string): string {
  return buildWebhookUrl(baseUrl, token);
}

export function parseTrackingFrequency(
  value: string | undefined
): TrackingFrequency {
  if (value === 'DAILY' || value === 'EVERY_3_DAYS' || value === 'WEEKLY') {
    return value;
  }
  return 'WEEKLY';
}

export type DataForSeoTaskPostResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    data?: {
      tag?: string;
    };
  }>;
};

export function extractDataForSeoErrorMessages(
  response: DataForSeoTaskPostResponse
): string[] {
  const messages: string[] = [];

  if (response.status_message) {
    messages.push(response.status_message);
  }

  for (const task of response.tasks ?? []) {
    if (task.status_message) {
      messages.push(task.status_message);
    }
  }

  return messages;
}

export async function postOrganicTasks(
  tasks: DataForSeoTaskPostItem[],
  credentials: DataForSeoCredentials,
  options?: { workspaceId?: string }
): Promise<DataForSeoTaskPostResponse> {
  const { response, value: body } = await withFetchTelemetry(
    {
      integrationType: 'DATAFORSEO',
      targetUrl: DATAFORSEO_ORGANIC_TASK_POST_URL,
      workspaceId: options?.workspaceId,
      operation: 'organic_task_post',
    },
    async () => {
      const response = await fetch(DATAFORSEO_ORGANIC_TASK_POST_URL, {
        method: 'POST',
        headers: {
          Authorization: buildDataForSeoAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tasks),
      });

      const body = (await response.json()) as DataForSeoTaskPostResponse;
      return { response, value: body };
    }
  );

  if (!response.ok) {
    const detail =
      extractDataForSeoErrorMessages(body)[0] ??
      body.status_message ??
      body.tasks?.[0]?.status_message;
    throw new Error(
      detail
        ? `DataForSEO task_post failed with HTTP ${response.status}: ${detail}`
        : `DataForSEO task_post failed with HTTP ${response.status}: ${response.statusText}`
    );
  }

  return body;
}

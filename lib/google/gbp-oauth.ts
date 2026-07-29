import { getPrisma } from '@/lib/prisma';

const GBP_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GBP_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
].join(' ');

export function getGbpOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_GBP_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.GOOGLE_GBP_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildGbpAuthUrl(redirectUri: string, state: string): string {
  const config = getGbpOAuthConfig();
  if (!config) throw new Error('Google OAuth is not configured');

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GBP_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGbpCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const config = getGbpOAuthConfig();
  if (!config) throw new Error('Google OAuth is not configured');

  const response = await fetch(GBP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange Google OAuth code');
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    throw new Error('No refresh token received. Revoke prior access and reconnect with consent.');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshGbpAccessToken(
  workspaceId: string
): Promise<string> {
  const prisma = getPrisma();
  const config = await prisma.integrationConfig.findFirst({
    where: { workspaceId },
    select: {
      googleBusinessProfileRefreshToken: true,
      googleBusinessProfileAccessToken: true,
      googleBusinessProfileTokenExpiry: true,
    },
  });

  if (!config?.googleBusinessProfileRefreshToken) {
    throw new Error('Google Business Profile is not connected');
  }

  const now = Date.now();
  const expiry = config.googleBusinessProfileTokenExpiry?.getTime() ?? 0;
  if (config.googleBusinessProfileAccessToken && expiry > now + 60_000) {
    return config.googleBusinessProfileAccessToken;
  }

  const oauth = getGbpOAuthConfig();
  if (!oauth) throw new Error('Google OAuth is not configured');

  const response = await fetch(GBP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: config.googleBusinessProfileRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google Business Profile token');
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  const tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

  await prisma.integrationConfig.updateMany({
    where: { workspaceId },
    data: {
      googleBusinessProfileAccessToken: data.access_token,
      googleBusinessProfileTokenExpiry: tokenExpiry,
      googleBusinessProfileConnected: true,
    },
  });

  return data.access_token;
}

export type GbpDailyMetrics = {
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  dailySeries: Array<{
    date: string;
    calls: number;
    websiteClicks: number;
    directionRequests: number;
  }>;
};

export async function fetchGbpPerformanceMetrics(
  workspaceId: string,
  locationId: string,
  startDate: string,
  endDate: string
): Promise<GbpDailyMetrics | null> {
  try {
    const accessToken = await refreshGbpAccessToken(workspaceId);

    const response = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${locationId}:fetchMultiDailyMetricsTimeSeries`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dailyMetrics: [
            'CALL_CLICKS',
            'WEBSITE_CLICKS',
            'BUSINESS_DIRECTION_REQUESTS',
          ],
          dailyRange: {
            startDate: parseDateParts(startDate),
            endDate: parseDateParts(endDate),
          },
        }),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      multiDailyMetricTimeSeries?: Array<{
        dailyMetricTimeSeries?: Array<{
          dailyMetric?: string;
          timeSeries?: { datedValues?: Array<{ date?: { year?: number; month?: number; day?: number }; value?: string }> };
        }>;
      }>;
    };

    const seriesMap = new Map<string, { calls: number; websiteClicks: number; directionRequests: number }>();

    for (const group of data.multiDailyMetricTimeSeries ?? []) {
      for (const metric of group.dailyMetricTimeSeries ?? []) {
        for (const point of metric.timeSeries?.datedValues ?? []) {
          const date = formatGbpDate(point.date);
          if (!date) continue;
          const existing = seriesMap.get(date) ?? {
            calls: 0,
            websiteClicks: 0,
            directionRequests: 0,
          };
          const value = Number(point.value ?? 0);
          if (metric.dailyMetric === 'CALL_CLICKS') existing.calls += value;
          if (metric.dailyMetric === 'WEBSITE_CLICKS') existing.websiteClicks += value;
          if (metric.dailyMetric === 'BUSINESS_DIRECTION_REQUESTS') {
            existing.directionRequests += value;
          }
          seriesMap.set(date, existing);
        }
      }
    }

    const dailySeries = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, metrics]) => ({ date, ...metrics }));

    return {
      calls: dailySeries.reduce((s, d) => s + d.calls, 0),
      websiteClicks: dailySeries.reduce((s, d) => s + d.websiteClicks, 0),
      directionRequests: dailySeries.reduce((s, d) => s + d.directionRequests, 0),
      dailySeries,
    };
  } catch {
    return null;
  }
}

function parseDateParts(iso: string): { year: number; month: number; day: number } {
  const d = new Date(iso);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function formatGbpDate(
  date?: { year?: number; month?: number; day?: number }
): string | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export { buildGoogleReviewShortLink } from '@/lib/local-dominance/review-link';

export async function fetchGbpReviews(
  workspaceId: string,
  accountId: string,
  locationId: string
): Promise<Array<{ id: string; text: string; rating: number; reviewer: string; createTime: string }>> {
  const accessToken = await refreshGbpAccessToken(workspaceId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    reviews?: Array<{
      reviewId?: string;
      comment?: string;
      starRating?: string;
      reviewer?: { displayName?: string };
      createTime?: string;
    }>;
  };

  const ratingMap: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };

  return (data.reviews ?? []).map(r => ({
    id: r.reviewId ?? '',
    text: r.comment ?? '',
    rating: ratingMap[r.starRating ?? ''] ?? 0,
    reviewer: r.reviewer?.displayName ?? 'Anonymous',
    createTime: r.createTime ?? '',
  }));
}

export async function publishGbpLocalPost(
  workspaceId: string,
  locationId: string,
  summary: string,
  mediaUrl?: string
): Promise<string | null> {
  const accessToken = await refreshGbpAccessToken(workspaceId);

  const body: Record<string, unknown> = {
    languageCode: 'en-US',
    summary,
    topicType: 'STANDARD',
  };

  if (mediaUrl) {
    body.media = [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }];
  }

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) return null;
  const data = (await response.json()) as { name?: string };
  return data.name ?? null;
}

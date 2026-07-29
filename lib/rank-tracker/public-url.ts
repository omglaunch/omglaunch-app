/** Resolve the public base URL for DataForSEO postback callbacks. */
export function resolvePublicBaseUrl(request: Request): string {
  const envUrl =
    process.env.RANK_TRACKER_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';

  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export function buildWebhookUrl(baseUrl: string, token: string): string {
  const encodedToken = encodeURIComponent(token);
  return `${baseUrl}/api/rank-tracker/webhook?token=${encodedToken}&tag=$tag`;
}

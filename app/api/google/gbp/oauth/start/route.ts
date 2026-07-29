import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { requireWorkspaceId, runWithAuthenticatedTenantScope } from '@/lib/projects/tenant-scope';
import { buildGbpAuthUrl } from '@/lib/google/gbp-oauth';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveRedirectUri(request: Request): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);
  return `${baseUrl.replace(/\/+$/, '')}/api/google/gbp/oauth/callback`;
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const state = `${workspaceId}:${randomBytes(16).toString('hex')}`;
      const redirectUri = resolveRedirectUri(request);
      const authUrl = buildGbpAuthUrl(redirectUri, state);

      const response = NextResponse.json({ authUrl });
      response.cookies.set('gbp_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });
      return response;
    });
  } catch (error) {
    console.error('[google/gbp/oauth/start]', error);
    const message = error instanceof Error ? error.message : 'OAuth start failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

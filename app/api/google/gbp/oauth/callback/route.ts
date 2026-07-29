import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { exchangeGbpCode } from '@/lib/google/gbp-oauth';
import { runWithTenantScopeAsync } from '@/lib/prisma/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveRedirectUri(request: Request): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);
  return `${baseUrl.replace(/\/+$/, '')}/api/google/gbp/oauth/callback`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const settingsUrl = '/settings?tab=integrations';

  if (error || !code || !state) {
    return NextResponse.redirect(new URL(`${settingsUrl}&gbp=error`, request.url));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('gbp_oauth_state')?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL(`${settingsUrl}&gbp=invalid_state`, request.url));
  }

  const [workspaceId] = state.split(':');
  if (!workspaceId) {
    return NextResponse.redirect(new URL(`${settingsUrl}&gbp=invalid_state`, request.url));
  }

  try {
    const tokens = await exchangeGbpCode(code, resolveRedirectUri(request));
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    await runWithTenantScopeAsync(workspaceId, async () => {
      await getPrisma().integrationConfig.updateMany({
        where: { workspaceId },
        data: {
          googleBusinessProfileConnected: true,
          googleBusinessProfileAccessToken: tokens.accessToken,
          googleBusinessProfileRefreshToken: tokens.refreshToken,
          googleBusinessProfileTokenExpiry: tokenExpiry,
        },
      });
    });

    const response = NextResponse.redirect(new URL(`${settingsUrl}&gbp=connected`, request.url));
    response.cookies.delete('gbp_oauth_state');
    return response;
  } catch (err) {
    console.error('[google/gbp/oauth/callback]', err);
    return NextResponse.redirect(new URL(`${settingsUrl}&gbp=error`, request.url));
  }
}

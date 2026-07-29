import { NextResponse } from 'next/server';
import { ClientShareError, unlockClientShareLink } from '@/lib/client-share/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UnlockBody = {
  shareToken?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UnlockBody;
    const shareToken = body.shareToken?.trim();
    const password = body.password ?? '';

    if (!shareToken) {
      return NextResponse.json({ error: 'shareToken is required' }, { status: 400 });
    }

    const unlock = await unlockClientShareLink(shareToken, password);
    const response = NextResponse.json({ success: true });
    response.cookies.set(unlock.cookieName, unlock.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: unlock.maxAge,
      path: '/',
    });
    return response;
  } catch (error) {
    if (error instanceof ClientShareError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[client-share/unlock]', error);
    return NextResponse.json({ error: 'Failed to unlock share link' }, { status: 500 });
  }
}

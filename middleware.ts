import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Injects the pathname for server layouts (viewer route guard).
 * Next.js 13 app layouts cannot read pathname directly on the server.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

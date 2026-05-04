import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './lib/session-edge';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API paths that don't need protection
  if (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/logout') {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;
  const isApiRoute = pathname.startsWith('/api/');

  if (!sessionCookie) {
    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifySessionToken(sessionCookie);

  if (!payload) {
    if (isApiRoute) {
      const response = NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } },
        { status: 401 }
      );
      response.cookies.set('session', '', { maxAge: 0, path: '/' });
      return response;
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('session', '', { maxAge: 0, path: '/' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.).*)'],
};

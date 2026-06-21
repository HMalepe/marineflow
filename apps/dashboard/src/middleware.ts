import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isJwtExpired } from '@/lib/jwt-payload';

const PUBLIC_PATHS = ['/login', '/onboarding'];
const TOKEN_KEY = 'mf_token';

function redirectToLogin(request: NextRequest, clearCookie: boolean) {
  const loginUrl = new URL('/login', request.url);
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', returnPath);
  const response = NextResponse.redirect(loginUrl);
  if (clearCookie) {
    response.cookies.delete(TOKEN_KEY);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_KEY)?.value;
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!token) {
    return redirectToLogin(request, false);
  }

  if (isJwtExpired(token)) {
    return redirectToLogin(request, true);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};

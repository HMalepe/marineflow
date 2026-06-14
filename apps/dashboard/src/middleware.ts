import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { postLoginDestination } from './lib/post-login-redirect';

const PUBLIC_PATHS = ['/login', '/onboarding'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('mf_token')?.value;
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (token) {
      const destination = postLoginDestination(request.nextUrl.searchParams.get('redirect'));
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    const returnPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set('redirect', returnPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/onboarding'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('mf_token')?.value;
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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

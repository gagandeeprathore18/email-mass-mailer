import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_this_in_production'
);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  let payload = null;
  if (token) {
    try {
      const { payload: verified } = await jwtVerify(token, JWT_SECRET);
      payload = verified;
    } catch (err) {
      // Token invalid
    }
  }

  const isProtectedPath = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/api/campaigns') || 
    pathname.startsWith('/api/send');

  const isAuthPath = pathname === '/auth' || pathname === '/';

  if (isProtectedPath && !payload) {
    const response = NextResponse.redirect(new URL('/auth', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  if (isAuthPath && payload) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/auth',
    '/dashboard/:path*',
    '/api/campaigns/:path*',
    '/api/send/:path*',
  ],
};

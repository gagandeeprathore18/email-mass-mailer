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

  // Redirect old /auth path to /
  if (pathname === '/auth') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const isProtectedPath = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/api/campaigns') || 
    pathname.startsWith('/api/send');

  const isAdminPath = (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && pathname !== '/admin/auth';
  const isAdminAuthPath = pathname === '/admin/auth';
  const isAuthPath = pathname === '/auth' || pathname === '/';

  // If trying to access admin path
  if (isAdminPath) {
    if (!payload) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const response = NextResponse.redirect(new URL('/admin/auth', request.url));
      response.cookies.delete('auth_token');
      return response;
    }
    
    if (payload.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // If trying to access standard protected path
  if (isProtectedPath && !payload) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  if (isAuthPath && payload) {
    if (payload.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isAdminAuthPath && payload) {
    if (payload.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/auth',
    '/admin/auth',
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/campaigns/:path*',
    '/api/send/:path*',
    '/api/admin/:path*',
  ],
};

import { NextRequest, NextResponse } from 'next/server';

/**
 * For /api-proxy/* requests, copy the access_token cookie into an
 * Authorization: Bearer header so the API receives a proper JWT.
 * The rewrite in next.config.ts handles the destination.
 */
export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api-proxy/')) return NextResponse.next();

  const token = req.cookies.get('access_token')?.value;
  if (!token) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api-proxy/:path*'],
};

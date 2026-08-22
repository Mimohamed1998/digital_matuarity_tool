import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Deny-by-default gate for every admin surface (FR-14, FR-17).
 *
 * This is the first of two gates. Each admin page and route also checks the session
 * itself (NFR-6) — if this matcher were ever misconfigured, or matching behaviour
 * changed in a future Next.js version, the pages must still refuse.
 */
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };

/** The only two paths that must work without a session — otherwise nobody can log in. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return withNoIndex(NextResponse.next());
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return withNoIndex(NextResponse.next());
  }

  if (pathname.startsWith('/api/admin')) {
    // No detail, and above all no data.
    return withNoIndex(NextResponse.json({ error: 'unauthorized' }, { status: 401 }));
  }

  const loginUrl = new URL('/admin/login', request.url);
  return withNoIndex(NextResponse.redirect(loginUrl));
}

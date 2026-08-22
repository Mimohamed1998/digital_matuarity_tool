import { NextResponse } from 'next/server';
import { checkRateLimit, clearRateLimit } from '@/lib/auth/rate-limit';
import { verifyAdminPassword } from '@/lib/auth/password';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One response for every failure.
 *
 * Wrong password, malformed body, missing field — all identical. Explaining *why*
 * authentication failed tells an attacker which half of the guess to change.
 */
function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
}

/** Best-effort client identity for rate limiting. Hashed before storage; never logged. */
function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit first, so a flood of malformed bodies is throttled the same as a flood of
  // wrong passwords.
  const limit = checkRateLimit(clientIp(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'too many attempts' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let password: unknown;
  try {
    const body: unknown = await request.json();
    password = (body as { password?: unknown } | null)?.password;
  } catch {
    return unauthorized();
  }

  if (typeof password !== 'string' || password.length === 0) {
    return unauthorized();
  }

  let valid: boolean;
  try {
    valid = verifyAdminPassword(password);
  } catch (error) {
    // A missing or weak ADMIN_PASSWORD. Log it for the operator; the caller gets the
    // same opaque 401 as any other failure.
    console.error(`[admin-login] ${error instanceof Error ? error.message : String(error)}`);
    return unauthorized();
  }

  if (!valid) return unauthorized();

  let token: string;
  try {
    token = await createSessionToken();
  } catch (error) {
    console.error(`[admin-login] ${error instanceof Error ? error.message : String(error)}`);
    return unauthorized();
  }

  clearRateLimit(clientIp(request));

  // 204 with the cookie set. The token is never returned in the body.
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}

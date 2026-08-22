import { SignJWT, jwtVerify } from 'jose';

/**
 * Admin session token.
 *
 * This module runs in middleware, which is Edge — so `jose`, never `node:crypto`.
 * Nothing here is ever logged or returned in a response body.
 */

export const SESSION_COOKIE = 'dm_admin';

/** Eight hours: long enough for a working session, short enough to be worth expiring. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const ALGORITHM = 'HS256';
const MINIMUM_SECRET_BYTES = 32;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

function requireSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set. Admin sessions cannot be issued or verified.');
  }
  const encoded = new TextEncoder().encode(secret);
  if (encoded.byteLength < MINIMUM_SECRET_BYTES) {
    throw new Error(
      `ADMIN_SESSION_SECRET must be at least ${MINIMUM_SECRET_BYTES} bytes. Admin sessions cannot be issued or verified.`,
    );
  }
  return encoded;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject('admin')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(requireSecret());
}

/**
 * Verify a session token.
 *
 * The algorithm is pinned to HS256. Without that pin, a token presenting `alg: none` or
 * a different algorithm could be accepted through algorithm confusion — the classic JWT
 * bypass, and the one that would hand over every respondent's data.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, requireSecret(), { algorithms: [ALGORITHM] });
    return payload.sub === 'admin';
  } catch {
    // Any failure — bad signature, expiry, tampering, wrong algorithm — is just "no".
    // The reason is never surfaced to the caller.
    return false;
  }
}

/** True when a session secret is configured and long enough. */
export function isSessionSecretConfigured(): boolean {
  try {
    requireSecret();
    return true;
  } catch {
    return false;
  }
}

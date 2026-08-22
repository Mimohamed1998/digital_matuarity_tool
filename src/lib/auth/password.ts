import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Shared-password verification for the single researcher who owns this study (OD-8).
 *
 * Node runtime only — `session.ts` is the Edge-compatible half.
 */

const MINIMUM_LENGTH = 12;

/**
 * Read and validate ADMIN_PASSWORD.
 *
 * On a public URL a weak shared password is the entire attack surface, so a missing or
 * short one is a hard failure rather than a warning. This is read lazily rather than at
 * module load so that `next build` — which imports every route module — does not require
 * the secret to be present at build time; the failure lands on the first login attempt
 * instead, which is still before anyone can get in.
 */
function requireAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set. Admin access is unavailable until it is.');
  }
  if (password.length < MINIMUM_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MINIMUM_LENGTH} characters. Admin access is unavailable until it is.`,
    );
  }
  return password;
}

/**
 * Compare a submitted password against ADMIN_PASSWORD in constant time.
 *
 * Both sides are hashed first so the buffers are always the same length:
 * `timingSafeEqual` throws on a length mismatch, and a plain `===` would leak the
 * password's length and matching prefix through timing.
 */
export function verifyAdminPassword(input: string): boolean {
  const expected = requireAdminPassword();
  const inputHash = createHash('sha256').update(input, 'utf8').digest();
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(inputHash, expectedHash);
}

/** True when an admin password is configured and long enough to be worth having. */
export function isAdminPasswordConfigured(): boolean {
  try {
    requireAdminPassword();
    return true;
  } catch {
    return false;
  }
}

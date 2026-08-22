import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  checkRateLimit,
  clearRateLimit,
  resetRateLimits,
} from '@/lib/auth/rate-limit';

const SECRET = 'a-test-secret-that-is-definitely-long-enough-32';
const OTHER_SECRET = 'a-different-secret-that-is-also-long-enough-32!';
const PASSWORD = 'correct-horse-battery-staple';

/** Import fresh each time so the modules read the env vars set for that test. */
async function loadSession() {
  return import('@/lib/auth/session');
}

async function loadPassword() {
  return import('@/lib/auth/password');
}

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
  process.env.ADMIN_PASSWORD = PASSWORD;
  resetRateLimits();
});

afterEach(() => {
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_PASSWORD;
});

describe('session tokens', () => {
  it('round-trips a valid token', async () => {
    const { createSessionToken, verifySessionToken } = await loadSession();
    const token = await createSessionToken();
    await expect(verifySessionToken(token)).resolves.toBe(true);
  });

  it('rejects an expired token', async () => {
    const { verifySessionToken } = await loadSession();
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySessionToken(expired)).resolves.toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const { verifySessionToken } = await loadSession();
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(OTHER_SECRET));
    await expect(verifySessionToken(foreign)).resolves.toBe(false);
  });

  it('rejects a tampered payload', async () => {
    const { createSessionToken, verifySessionToken } = await loadSession();
    const token = await createSessionToken();
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 99999 }),
    ).toString('base64url');
    await expect(verifySessionToken(`${header}.${forgedPayload}.${signature}`)).resolves.toBe(
      false,
    );
  });

  it('rejects an alg: none token', async () => {
    const { verifySessionToken } = await loadSession();
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    await expect(verifySessionToken(`${header}.${payload}.`)).resolves.toBe(false);
  });

  it('rejects a token that claims RS256', async () => {
    const { verifySessionToken } = await loadSession();
    // Signed with the HMAC secret but labelled RS256 — the algorithm-confusion attempt.
    const confused = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(SECRET));
    const [, payload, signature] = confused.split('.');
    const rsHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
      'base64url',
    );
    await expect(verifySessionToken(`${rsHeader}.${payload}.${signature}`)).resolves.toBe(false);
  });

  it('rejects an absent token', async () => {
    const { verifySessionToken } = await loadSession();
    await expect(verifySessionToken(undefined)).resolves.toBe(false);
    await expect(verifySessionToken('')).resolves.toBe(false);
    await expect(verifySessionToken('not-a-jwt')).resolves.toBe(false);
  });

  it('refuses to issue a token when the secret is too short', async () => {
    process.env.ADMIN_SESSION_SECRET = 'too-short';
    const { createSessionToken, isSessionSecretConfigured } = await loadSession();
    expect(isSessionSecretConfigured()).toBe(false);
    await expect(createSessionToken()).rejects.toThrow(/at least 32 bytes/);
  });

  it('never puts the secret in the error message', async () => {
    process.env.ADMIN_SESSION_SECRET = 'too-short';
    const { createSessionToken } = await loadSession();
    const error = await createSessionToken().catch((e: unknown) => e as Error);
    expect((error as Error).message).not.toContain('too-short');
  });
});

describe('password verification', () => {
  it('accepts the correct password', async () => {
    const { verifyAdminPassword } = await loadPassword();
    expect(verifyAdminPassword(PASSWORD)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { verifyAdminPassword } = await loadPassword();
    expect(verifyAdminPassword('not-the-password-at-all')).toBe(false);
  });

  it('rejects a wrong password of exactly the same length', async () => {
    const { verifyAdminPassword } = await loadPassword();
    const sameLength = 'x'.repeat(PASSWORD.length);
    expect(sameLength).toHaveLength(PASSWORD.length);
    expect(verifyAdminPassword(sameLength)).toBe(false);
  });

  it('rejects a password that is a prefix of the correct one', async () => {
    const { verifyAdminPassword } = await loadPassword();
    expect(verifyAdminPassword(PASSWORD.slice(0, -1))).toBe(false);
  });

  it('fails loudly when ADMIN_PASSWORD is missing', async () => {
    delete process.env.ADMIN_PASSWORD;
    const { verifyAdminPassword, isAdminPasswordConfigured } = await loadPassword();
    expect(isAdminPasswordConfigured()).toBe(false);
    expect(() => verifyAdminPassword('anything')).toThrow(/ADMIN_PASSWORD is not set/);
  });

  it('fails loudly when ADMIN_PASSWORD is shorter than 12 characters', async () => {
    process.env.ADMIN_PASSWORD = 'short';
    const { verifyAdminPassword } = await loadPassword();
    expect(() => verifyAdminPassword('short')).toThrow(/at least 12 characters/);
  });

  it('never puts the configured password in the error message', async () => {
    process.env.ADMIN_PASSWORD = 'shortpw';
    const { verifyAdminPassword } = await loadPassword();
    try {
      verifyAdminPassword('shortpw');
      expect.unreachable('expected a throw');
    } catch (error) {
      expect((error as Error).message).not.toContain('shortpw');
    }
  });
});

describe('login rate limiting', () => {
  it('allows attempts up to the limit, then blocks', () => {
    for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      expect(checkRateLimit('203.0.113.7').allowed).toBe(true);
    }
    const blocked = checkRateLimit('203.0.113.7');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts each client separately', () => {
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      checkRateLimit('203.0.113.7');
    }
    expect(checkRateLimit('203.0.113.8').allowed).toBe(true);
  });

  it('resets once the window has passed', () => {
    const start = Date.now();
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      checkRateLimit('203.0.113.9', start);
    }
    expect(checkRateLimit('203.0.113.9', start).allowed).toBe(false);
    expect(checkRateLimit('203.0.113.9', start + 16 * 60 * 1000).allowed).toBe(true);
  });

  it('clears a window after a successful login', () => {
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      checkRateLimit('203.0.113.10');
    }
    expect(checkRateLimit('203.0.113.10').allowed).toBe(false);
    clearRateLimit('203.0.113.10');
    expect(checkRateLimit('203.0.113.10').allowed).toBe(true);
  });
});

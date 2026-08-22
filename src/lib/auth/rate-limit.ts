import { createHash } from 'node:crypto';

/**
 * Fixed-window login rate limiting.
 *
 * LIMITATION, stated honestly: this counter lives in a module-level Map, which means it
 * is per-instance. On serverless each cold start gets a fresh one and concurrent
 * instances do not share state, so this is best-effort — it raises the cost of an online
 * brute-force attempt, it does not prevent one. The real defence is the length of
 * ADMIN_PASSWORD (>= 12 characters, enforced in password.ts). Moving this to Redis or
 * Vercel KV would make it authoritative, at the cost of a dependency.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** The key is a hash, so a raw IP address is never held in memory or logged. */
function keyFor(clientIp: string): string {
  return createHash('sha256').update(clientIp).digest('hex');
}

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — for the Retry-After header. */
  retryAfterSeconds: number;
}

/** Count one attempt against the caller's window. */
export function checkRateLimit(clientIp: string, now: number = Date.now()): RateLimitResult {
  sweep(now);

  const key = keyFor(clientIp);
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clear the window for a client — called after a successful login. */
export function clearRateLimit(clientIp: string): void {
  windows.delete(keyFor(clientIp));
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}

export const RATE_LIMIT_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const RATE_LIMIT_WINDOW_MS = WINDOW_MS;

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The access-control audit (FR-17, NFR-6).
 *
 * "Users should not be able to access this" is a requirement, and a requirement you have
 * not tested is a requirement you have not met. This runs a real production server and
 * asserts the exact status of every route, unauthenticated and authenticated.
 */

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = 'a-strong-audit-test-password';
const ADMIN_SESSION_SECRET = 'audit-test-session-secret-at-least-32-bytes';

/** Seeded into the store by the audit; must never appear in an unauthenticated response. */
const SEEDED_NAME = 'Marguerite Ashworth-Vance';

let server: ChildProcess;
let sessionCookie = '';
let seededId = '';

const VALID_ANSWERS = {
  leadership: 5,
  strategy_governance: 4,
  people_culture: 3,
  technology: 2,
  research: 4,
  design: 2,
  development: 3,
};

async function waitForServer(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/`, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('production server did not start in time');
}

beforeAll(async () => {
  server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    env: {
      ...process.env,
      ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET,
      NODE_ENV: 'production',
      // Persist for real, so "no data leaked" is a claim about data that exists.
      SUBMISSION_STORE: 'fs',
    },
    stdio: 'ignore',
    detached: false,
  });
  await waitForServer();

  // Seed one submission so "did any data leak?" is a question with a real answer.
  const created = await fetch(`${BASE}/api/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      respondent: { name: SEEDED_NAME, designation: 'Audit Fixture' },
      answers: VALID_ANSWERS,
    }),
  });
  const createdBody = (await created.json()) as { id: string; stored: boolean };
  seededId = createdBody.id;
  // If this is false the leak assertions below prove nothing, so fail loudly here.
  expect(createdBody.stored, 'the audit needs a store that actually persists').toBe(true);

  const login = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  sessionCookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(login.status).toBe(204);
  expect(sessionCookie).toMatch(/^dm_admin=/);
}, 180_000);

afterAll(() => {
  server?.kill('SIGTERM');
});

interface Case {
  path: string;
  method: 'GET' | 'POST';
  expected: number;
  redirectsTo?: string;
  body?: string;
}

const UNAUTHENTICATED_CASES: Case[] = [
  { path: '/', method: 'GET', expected: 200 },
  { path: '/model', method: 'GET', expected: 200 },
  { path: '/survey', method: 'GET', expected: 200 },
  { path: '/results', method: 'GET', expected: 200 },
  {
    path: '/api/submissions',
    method: 'POST',
    expected: 200,
    body: JSON.stringify({ respondent: { designation: 'x' }, answers: VALID_ANSWERS }),
  },
  { path: '/api/submissions', method: 'GET', expected: 405 },
  { path: '/admin', method: 'GET', expected: 307, redirectsTo: '/admin/login' },
  { path: '/admin/login', method: 'GET', expected: 200 },
  { path: '/admin/submissions/whatever', method: 'GET', expected: 307, redirectsTo: '/admin/login' },
  { path: '/api/admin/submissions', method: 'GET', expected: 401 },
  { path: '/api/admin/export?format=csv', method: 'GET', expected: 401 },
  { path: '/api/admin/export?format=json', method: 'GET', expected: 401 },
  { path: '/api/admin/logout', method: 'POST', expected: 401 },
];

describe('unauthenticated access', () => {
  it.each(UNAUTHENTICATED_CASES)(
    '$method $path → $expected',
    async ({ path, method, expected, redirectsTo, body }) => {
      const response = await fetch(`${BASE}${path}`, {
        method,
        redirect: 'manual',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body,
      });
      expect(response.status).toBe(expected);
      if (redirectsTo) {
        expect(response.headers.get('location')).toContain(redirectsTo);
      }
    },
  );

  it('leaks no respondent name in any unauthenticated response body', async () => {
    for (const { path, method, body } of UNAUTHENTICATED_CASES) {
      const response = await fetch(`${BASE}${path}`, {
        method,
        redirect: 'manual',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body,
      });
      const text = await response.text();
      expect(text, `${method} ${path} leaked a respondent name`).not.toContain(SEEDED_NAME);
      expect(text, `${method} ${path} leaked the seeded id`).not.toContain(seededId);
    }
  });

  it('returns no submission data in the 401 body', async () => {
    const response = await fetch(`${BASE}/api/admin/export?format=json`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('marks admin surfaces noindex', async () => {
    const response = await fetch(`${BASE}/admin/login`, { redirect: 'manual' });
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('disallows admin paths in robots.txt', async () => {
    const text = await (await fetch(`${BASE}/robots.txt`)).text();
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Disallow: /api/admin');
  });

  it('sends the security headers on a public page', async () => {
    const response = await fetch(`${BASE}/`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('rejects a tampered session cookie', async () => {
    const [, payload, signature] = sessionCookie.replace('dm_admin=', '').split('.');
    const forgedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    );
    const response = await fetch(`${BASE}/api/admin/submissions`, {
      headers: { cookie: `dm_admin=${forgedHeader}.${payload}.${signature}` },
      redirect: 'manual',
    });
    expect(response.status).toBe(401);
  });
});

describe('authenticated access', () => {
  const authed = () => ({ cookie: sessionCookie });

  it('reaches the dashboard', async () => {
    const response = await fetch(`${BASE}/admin`, { headers: authed(), redirect: 'manual' });
    expect(response.status).toBe(200);
  });

  it('reaches the seeded submission and shows its respondent name', async () => {
    const response = await fetch(`${BASE}/admin/submissions/${seededId}`, {
      headers: authed(),
      redirect: 'manual',
    });
    expect(response.status).toBe(200);
    // The same name that must never appear unauthenticated does appear here.
    expect(await response.text()).toContain(SEEDED_NAME);
  });

  it('404s an unknown submission id rather than crashing', async () => {
    const response = await fetch(`${BASE}/admin/submissions/no-such-id`, {
      headers: authed(),
      redirect: 'manual',
    });
    expect(response.status).toBe(404);
  });

  it('exports CSV', async () => {
    const response = await fetch(`${BASE}/api/admin/export?format=csv`, { headers: authed() });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    const text = await response.text();
    expect(text).toContain('answer_leadership');
    expect(text).toContain(SEEDED_NAME);
    expect(text).toContain(seededId);
  });

  it('exports JSON', async () => {
    const response = await fetch(`${BASE}/api/admin/export?format=json`, { headers: authed() });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBeInstanceOf(Array);
  });

  it('rejects an unknown export format', async () => {
    const response = await fetch(`${BASE}/api/admin/export?format=xlsx`, { headers: authed() });
    expect(response.status).toBe(400);
  });

  it('logs out', async () => {
    const response = await fetch(`${BASE}/api/admin/logout`, {
      method: 'POST',
      headers: authed(),
    });
    expect(response.status).toBe(204);
  });

  it('leaves the public routes behaving exactly as before', async () => {
    for (const path of ['/', '/model', '/survey', '/results']) {
      const response = await fetch(`${BASE}${path}`, { headers: authed(), redirect: 'manual' });
      expect(response.status).toBe(200);
    }
    const get = await fetch(`${BASE}/api/submissions`, { headers: authed(), redirect: 'manual' });
    expect(get.status).toBe(405);
  });
});


/** Every .ts/.tsx file under a directory, recursively. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * The import boundary, asserted rather than grepped by hand.
 *
 * A grep in a task checklist is only true on the day someone runs it. These run on every
 * `npm test`, so the boundary stays true as the app grows.
 */
describe('import boundaries', () => {
  const files = sourceFiles('src');

  it('keeps src/lib/auth out of everything except admin routes', () => {
    const offenders = files.filter((file) => {
      if (file.includes(path.join('lib', 'auth'))) return false;
      if (file.includes(path.join('app', 'admin'))) return false;
      if (file.includes(path.join('app', 'api', 'admin'))) return false;
      return readFileSync(file, 'utf8').includes('@/lib/auth');
    });
    expect(offenders).toEqual([]);
  });

  it('never imports the storage layer at runtime from a client component', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      if (!source.includes("'use client'")) return false;
      // A type-only import is erased at compile time and cannot reach the browser.
      return /import\s+(?!type\b)[^;]*from\s+'@\/lib\/(storage|auth)'/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('calls the read methods only from admin surfaces', () => {
    const readMethods = /\bstore\.(list|get|all|summary)\s*\(|getStore\(\)\.(list|get|all|summary)\s*\(/;
    const offenders = files.filter((file) => {
      if (file.includes(path.join('app', 'admin'))) return false;
      if (file.includes(path.join('app', 'api', 'admin'))) return false;
      if (file.includes(path.join('lib', 'storage'))) return false;
      return readMethods.test(readFileSync(file, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });

  it('exposes no NEXT_PUBLIC_ variable carrying admin or database configuration', () => {
    const offenders = files.filter((file) =>
      /NEXT_PUBLIC_\w*(ADMIN|PASSWORD|SECRET|DATABASE)/i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the config loader (which reads the filesystem) out of client components', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return source.includes("'use client'") && source.includes('@/lib/config/load');
    });
    expect(offenders).toEqual([]);
  });
});

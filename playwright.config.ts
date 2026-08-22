import { defineConfig } from '@playwright/test';

const PORT = 3210;
// Test-only credentials. They exist nowhere but here and in e2e/admin.spec.ts.
const ADMIN_PASSWORD = 'playwright-e2e-admin-password';
const ADMIN_SESSION_SECRET = 'playwright-e2e-session-secret-at-least-32-bytes';

/**
 * End-to-end tests run against a real production build.
 *
 * SUBMISSION_STORE=fs forces the filesystem adapter, so the admin spec can actually find
 * the submission the happy-path spec just created — without it, a production server with
 * no DATABASE_URL persists nothing and the admin test would prove nothing.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET,
      SUBMISSION_STORE: 'fs',
    },
  },
});

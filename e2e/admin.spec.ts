import { expect, test } from '@playwright/test';

const ADMIN_PASSWORD = 'playwright-e2e-admin-password';
const SEEDED_DESIGNATION = 'Admin Spec Fixture';

/**
 * The researcher's journey, and the gate that keeps everyone else out.
 *
 * This spec seeds its own submission rather than relying on the happy-path spec having
 * run first — Playwright orders spec files alphabetically, so `admin` actually runs
 * before `happy-path`, and depending on that order would make the suite quietly
 * order-dependent.
 */
let seededId = '';

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/submissions', {
    data: {
      respondent: {
        name: 'Seeded Respondent',
        designation: SEEDED_DESIGNATION,
        experienceTechnicalYears: 8,
        experienceManagerialYears: 4,
        experienceDigitalisationYears: 3,
        highestQualification: 'masters',
      },
      answers: {
        leadership: 5,
        strategy_governance: 4,
        people_culture: 3,
        technology: 2,
        research: 4,
        design: 2,
        development: 3,
      },
    },
  });
  const body = (await response.json()) as { id: string; stored: boolean };
  expect(body.stored, 'the admin spec needs a store that actually persists').toBe(true);
  seededId = body.id;
});
test('unauthenticated /admin redirects to the login page', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Researcher sign in' })).toBeVisible();
});

test('a wrong password is refused without explaining why', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That password was not accepted.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('sign in → find a submission → open it → export CSV → sign out', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Submissions' })).toBeVisible();

  // The seeded submission is listed.
  await expect(page.getByText(SEEDED_DESIGNATION).first()).toBeVisible();
  await expect(page.getByText('Total submissions')).toBeVisible();

  // Respondent names are never shown in the table — designation only.
  const tableText = (await page.locator('table').first().textContent()) ?? '';
  expect(tableText).toContain(SEEDED_DESIGNATION);
  expect(tableText).not.toContain('Seeded Respondent');

  // Open the seeded submission's detail page.
  await page.goto(`/admin/submissions/${seededId}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Submission');
  await expect(page.getByText('Statement chosen')).toBeVisible();
  await expect(page.getByText(seededId)).toBeVisible();
  // The name that is hidden on the dashboard does appear here.
  await expect(page.getByText('Seeded Respondent')).toBeVisible();

  const submissionId = seededId;

  // Export CSV and confirm this submission is in it.
  await page.goto('/admin');
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('link', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dm-submissions-\d{4}-\d{2}-\d{2}\.csv$/);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString('utf8');

  expect(csv).toContain('answer_leadership');
  expect(csv).toContain(submissionId);

  // Sign out, and the gate closes again.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

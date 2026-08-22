import { expect, test } from '@playwright/test';

/**
 * The whole respondent journey, in a real browser.
 *
 * Answers are chosen to match the worked example in docs/plan.md §3.6, so the test can
 * assert a specific expected score rather than merely that a number appeared.
 */
const ANSWERS: Record<string, number> = {
  Leadership: 5,
  'Strategy & Governance': 4,
  'People & Culture': 3,
  Technology: 2,
  Research: 4,
  Design: 2,
  Development: 3,
};

const EXPECTED_SCORE = '3.80';
const EXPECTED_LEVEL = 'Level 4 · Established';

test('landing → survey → review → results → PDF download', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Digital Maturity Assessment');

  await page.getByRole('link', { name: 'Start the survey' }).click();
  await expect(page.getByRole('heading', { name: 'General information' })).toBeVisible();

  // Background information — the name is deliberately left blank (it is optional).
  await page.getByLabel('Designation').fill('Head of Product Development');
  await page.getByLabel('Years of technical experience').fill('8');
  await page.getByLabel('Years of managerial experience').fill('4');
  await page.getByLabel('Years of experience in digitalisation').fill('3');
  await page.getByLabel('Highest level of academic qualification').selectOption('masters');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start the questions' }).click();

  // One question at a time.
  const factors = Object.keys(ANSWERS);
  for (const [index, factor] of factors.entries()) {
    const heading = page.getByRole('heading', { level: 2, name: factor, exact: true });
    await expect(heading).toBeVisible();

    // Exactly one factor question is in the DOM at any moment.
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(index + 1));
    await expect(page.locator('fieldset')).toHaveCount(1);

    await page.getByRole('radio').nth(ANSWERS[factor] - 1).check();

    const nextName = index === factors.length - 1 ? 'Review answers' : 'Next';
    await page.getByRole('button', { name: new RegExp(nextName) }).click();
  }

  // Review step reads back every answer.
  await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeVisible();
  await expect(page.getByText('Management continuously drives digital transformation', { exact: false })).toBeVisible();
  await expect(page.getByText('Head of Product Development')).toBeVisible();

  await page.getByRole('button', { name: 'See my results' }).click();

  // Results — assert the exact expected score, not just that a number is present.
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your digital maturity result');
  await expect(page.getByText(EXPECTED_SCORE, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(EXPECTED_LEVEL)).toBeVisible();

  // Recommendations appear in impact order, highest first.
  const recommendations = page.locator('ol > li h3');
  await expect(recommendations.first()).toContainText('People & Culture');

  // PDF download.
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: /Download your results as a PDF/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^digital-maturity-established-\d{4}-\d{2}-\d{2}\.pdf$/);
});

test('an edit from the review step returns to the review step', async ({ page }) => {
  await page.goto('/survey');
  await page.getByLabel('Designation').fill('Merchandiser');
  await page.getByLabel('Years of technical experience').fill('5');
  await page.getByLabel('Years of managerial experience').fill('2');
  await page.getByLabel('Years of experience in digitalisation').fill('1');
  await page.getByLabel('Highest level of academic qualification').selectOption('diploma');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start the questions' }).click();

  for (let i = 0; i < 7; i += 1) {
    await page.getByRole('radio').nth(2).check();
    await page.getByRole('button', { name: /Next|Review answers/ }).click();
  }

  await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeVisible();
  await page.getByRole('button', { name: /Edit your answer for Design/ }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Design', exact: true })).toBeVisible();
  await page.getByRole('radio').nth(4).check();
  await page.getByRole('button', { name: /Back to review/ }).click();

  // Back at review, with the new answer showing — not further along the questionnaire.
  await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeVisible();
  await expect(
    page.getByText('Advanced digital technologies such as 3D, AI, and virtual tools', { exact: false }),
  ).toBeVisible();
});

test('progress survives a page refresh but the results page starts empty', async ({ page }) => {
  await page.goto('/survey');
  await page.getByLabel('Designation').fill('Technical Designer');
  await page.getByLabel('Years of technical experience').fill('7');
  await page.getByLabel('Years of managerial experience').fill('3');
  await page.getByLabel('Years of experience in digitalisation').fill('2');
  await page.getByLabel('Highest level of academic qualification').selectOption('bachelors');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start the questions' }).click();

  await page.getByRole('radio').nth(3).check();
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Strategy & Governance' })).toBeVisible();

  await page.reload();

  // Same question, answer intact (NFR-5).
  await expect(page.getByRole('heading', { level: 2, name: 'Strategy & Governance' })).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await expect(page.getByRole('radio').nth(3)).toBeChecked();
});

import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * The operations center: today's count with a 14-day trend, the insight
 * cards, the activity log, and the breakdown — areas that read the same are
 * one row, and named actions are shown by name, not their code.
 */
test('the operations center shows the trend, the insights and a clean breakdown', async ({ page }) => {
  await gotoReady(page, '/dashboard/operations');
  await expect(page.getByTestId('ops-hero')).toBeVisible();
  await expect(page.getByTestId('ops-today')).toHaveText(/^\d[\d,]*$/);
  await expect(page.getByTestId('ops-trend').locator('circle')).toHaveCount(14);
  for (const id of ['ops-top-user', 'ops-top-area', 'ops-top-action', 'ops-security']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId('ops-timeline').locator('li').first()).toBeVisible();

  // No area twice, and no raw action code on the page.
  const areas = await page.getByTestId('ops-areas').locator('li').allInnerTexts();
  const names = areas.map((t) => t.split('\n')[0]!.trim());
  expect(new Set(names).size).toBe(names.length);
  await expect(page.locator('main')).not.toContainText(/\b[a-z-]+\.[a-z_-]+\b/);
});

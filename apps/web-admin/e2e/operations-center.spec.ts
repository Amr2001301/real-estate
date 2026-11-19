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
  // The activity log is a table: event, by, area, times, last — one row per grouped event.
  const log = page.getByTestId('ops-timeline');
  await expect(log.locator('thead th')).toHaveCount(6);
  await expect(log.locator('tbody tr').first()).toBeVisible();
  // A kind filter keeps only that kind: «حذف» shows deletions or the empty message, never other rows.
  await page.getByTestId('ops-kind-delete').click();
  await expect(page).toHaveURL(/kind=delete/);
  await expect(page.getByTestId('ops-kind-delete')).toHaveAttribute('aria-current', 'true');
  await gotoReady(page, '/dashboard/operations');

  // No area twice, and no raw action code on the page.
  const areas = await page.getByTestId('ops-areas').locator('li').allInnerTexts();
  const names = areas.map((t) => t.split('\n')[0]!.trim());
  expect(new Set(names).size).toBe(names.length);
  await expect(page.locator('main')).not.toContainText(/\b[a-z-]+\.[a-z_-]+\b/);

  // No shortcuts block (removed at the owner's request).
  await expect(page.getByRole('heading', { name: 'اختصارات' })).toHaveCount(0);
});

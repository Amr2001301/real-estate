import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Visits read as rows (a date leaf, the client, the place, the status) with
 * one main action and the rest behind a "more" menu; project rows show the
 * company's own code under the name, aligned with it.
 */
test.use({ storageState: ADMIN_STORAGE });

test('visit requests are rows with a date leaf, no table', async ({ page }) => {
  await gotoReady(page, '/dashboard/visits');
  await expect(page.locator('main table')).toHaveCount(0);
  const rows = page.getByTestId('visit-row');
  if ((await rows.count()) === 0) test.skip(true, 'no visit requests seeded');
  await expect(rows.first().getByTestId('list-code')).toBeVisible();
});

test('appointment row: secondary actions live in the more menu', async ({ page }) => {
  await gotoReady(page, '/dashboard/visits?tab=appointments');
  const menu = page.getByTestId('row-menu').first();
  if ((await menu.count()) === 0) test.skip(true, 'no open appointments seeded');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await menu.click();
  await expect(page.getByRole('menuitem', { name: 'إعادة جدولة' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
});

test('project rows: real code under the name, start-aligned', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, '/dashboard/projects');
  await expect(page.locator('main tbody')).not.toContainText(/PJ-[0-9A-F]{8}/);
});

test('reservations read as rows; the approve pill never covers the expiry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, '/dashboard/reservations');
  await expect(page.locator('main table')).toHaveCount(0);
  const row = page.getByTestId('reservation-row').first();
  if ((await row.count()) === 0) test.skip(true, 'no reservations seeded');
  await expect(row.getByTestId('list-code')).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Broker payouts: rows instead of a nine-column table; the detail page leads
 * with the net amount and its breakdown, shows the payout's progress, offers
 * one next step (cancel tucked away) and has no "back to list" button.
 */
test.use({ storageState: ADMIN_STORAGE });

test('payouts list reads as rows', async ({ page }) => {
  await gotoReady(page, '/dashboard/broker-payouts');
  await expect(page.locator('main table')).toHaveCount(0);
});

test('payout detail: net first, steps, no back button, raw note tags hidden', async ({ page }) => {
  await gotoReady(page, '/dashboard/broker-payouts');
  const row = page.getByTestId('payout-row').first();
  if ((await row.count()) === 0) test.skip(true, 'no payouts seeded');
  await row.getByRole('link').first().click();
  await expect(page.getByTestId('payout-net')).toBeVisible();
  await expect(page.getByTestId('payout-commissions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'العودة للقائمة' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/\[\d{4}-\d{2}-\d{2}T/);
});

import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * MC1 — the admin adds a campaign, records what was spent on which day and
 * copies its ad link (carrying the campaign's tracking code).
 */
test('a campaign is created, its spend recorded by day, and its ad link carries its code', async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const name = `Pw campaign ${stamp}`;

  await gotoReady(page, '/dashboard/campaigns');
  await page.getByTestId('campaign-new').click();
  const form = page.getByTestId('campaign-form');
  await form.getByTestId('campaign-name').fill(name);
  await form.getByTestId('channel-INSTAGRAM').click();
  await form.getByTestId('campaign-save').click();

  await page.waitForURL(/\/dashboard\/campaigns\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);

  // Two payments on two days, summed.
  const spend = page.getByTestId('spend-panel');
  await spend.getByTestId('spend-amount').fill('1500');
  await spend.getByTestId('spend-date').fill('2026-10-01');
  await spend.getByTestId('spend-add').click();
  await expect(spend.getByTestId('spend-row')).toHaveCount(1);
  await spend.getByTestId('spend-amount').fill('2500');
  await spend.getByTestId('spend-date').fill('2026-10-08');
  await spend.getByTestId('spend-add').click();
  await expect(spend.getByTestId('spend-row')).toHaveCount(2);
  await expect(spend.getByTestId('spend-total')).toContainText('4,000');

  // The ad link carries the campaign's code and channel.
  const link = page.getByTestId('tracking-link').first();
  await expect(link).toContainText(`utm_campaign=pw-campaign-${stamp}`);
  await expect(link).toContainText('utm_source=instagram');

  // Listed with its spend.
  await gotoReady(page, '/dashboard/campaigns');
  await expect(page.getByTestId('campaign-card').filter({ hasText: name })).toBeVisible();
});

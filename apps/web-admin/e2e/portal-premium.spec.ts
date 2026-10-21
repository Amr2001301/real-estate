import { test, expect } from '@playwright/test';
import { BROKER_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Broker portal in the premium look: the sidebar names the brokers' portal,
 * dates read in order, lists are rows, money reads "8.87 مليون ج.م" rather
 * than "8.9م", and project cards show a real commission figure.
 */
test.use({ storageState: BROKER_STORAGE });

test('portal home: brokers portal subtitle, recent leads as rows, no scrambled dates', async ({ page }) => {
  await gotoReady(page, '/portal');
  await expect(page.getByText('بوابة الوسطاء').first()).toBeVisible();
  await expect(page.getByText('بوابة المسؤولين')).toHaveCount(0);
  await expect(page.locator('main table')).toHaveCount(0);
  // A dir=ltr wrapper around Arabic dates rendered "222028/02/22 – 2026/02/".
  await expect(page.locator('main')).not.toContainText(/\d{6}\//);
  await expect(page.getByRole('link', { name: /\+ ?فرصة جديدة/ })).toHaveCount(0);
});

test('portal performance: one figures strip, money not glued to م/ك, rows not tables', async ({ page }) => {
  await gotoReady(page, '/portal/performance');
  await expect(page.getByTestId('figure-bar')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\d[مك] ج\.م/);
  await expect(page.locator('main table')).toHaveCount(0);
});

test('portal projects: figures strip and a numeric commission on each card', async ({ page }) => {
  await gotoReady(page, '/portal/projects');
  await expect(page.getByTestId('figure-bar')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/الافتراضية\s*$/m);
});

for (const path of ['/portal/leads', '/portal/visits', '/portal/reservations', '/portal/contracts', '/portal/commissions', '/portal/payouts', '/portal/units', '/portal/team']) {
  test(`${path}: figures strip and rows, no table`, async ({ page }) => {
    await gotoReady(page, path);
    await expect(page.getByTestId('figure-bar')).toBeVisible();
    await expect(page.locator('main table')).toHaveCount(0);
  });
}

test('portal activity: grouped by day, times not scrambled', async ({ page }) => {
  await gotoReady(page, '/portal/activity');
  await expect(page.locator('main')).not.toContainText(/\d{2}[صم] \d/);
  await expect(page.locator('main table')).toHaveCount(0);
});

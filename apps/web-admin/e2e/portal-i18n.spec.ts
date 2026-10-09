import { test, expect } from '@playwright/test';
import { BROKER_STORAGE } from './global-setup';

test.use({ storageState: BROKER_STORAGE });

/**
 * The broker portal follows the admin-locale cookie like the dashboard. In
 * English no Arabic may remain — UI text, digits, dates or currency symbols.
 */
const ROUTES = [
  '/portal', '/portal/performance', '/portal/projects', '/portal/units',
  '/portal/leads', '/portal/leads/new', '/portal/visits', '/portal/visits/new',
  '/portal/reservations', '/portal/reservations/new', '/portal/contracts',
  '/portal/commissions', '/portal/payouts', '/portal/activity',
  '/portal/notifications', '/portal/team', '/portal/profile',
];

// Arabic letters, Arabic-Indic digits and their separators.
const ARABIC = /[\u0621-\u064A\u0660-\u066C]/;

for (const route of ROUTES) {
  test(`${route} has no Arabic UI text in English`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'admin-locale', value: 'en', url: baseURL! }]);
    await page.goto(route, { waitUntil: 'networkidle' });
    const text = await page.locator('main').innerText();
    const arabic = text.split('\n').filter((l) => ARABIC.test(l));
    expect(arabic).toEqual([]);
  });
}

test('the portal still renders in Arabic by default', async ({ page }) => {
  await page.goto('/portal/leads', { waitUntil: 'networkidle' });
  await expect(page.locator('main')).toContainText('فرصي');
});

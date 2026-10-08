import { test, expect } from '@playwright/test';
import { BROKER_STORAGE } from './global-setup';

test.use({ storageState: BROKER_STORAGE });

/**
 * The broker portal follows the admin-locale cookie like the dashboard. In
 * English no Arabic UI text may remain. Dates and amounts are excluded: the
 * shared formatDate/formatCurrency helpers format in ar-EG for every locale.
 */
const ROUTES = [
  '/portal', '/portal/performance', '/portal/projects', '/portal/units',
  '/portal/leads', '/portal/leads/new', '/portal/visits', '/portal/visits/new',
  '/portal/reservations', '/portal/reservations/new', '/portal/contracts',
  '/portal/commissions', '/portal/payouts', '/portal/activity',
  '/portal/notifications', '/portal/team', '/portal/profile',
];

// A line is UI text when it still has Arabic letters once Arabic-Indic digits,
// date/number marks and the currency symbols are removed.
const AR_LETTERS = /[ء-ي]/;
const strip = (l: string) => l.replace(/[٠-٩٫٬‏؜]/g, '').replace(/ر\.س\.?|ج\.م\.?/g, '');

for (const route of ROUTES) {
  test(`${route} has no Arabic UI text in English`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'admin-locale', value: 'en', url: baseURL! }]);
    await page.goto(route, { waitUntil: 'networkidle' });
    const text = await page.locator('main').innerText();
    const arabic = text.split('\n').filter((l) => AR_LETTERS.test(strip(l)));
    expect(arabic).toEqual([]);
  });
}

test('the portal still renders in Arabic by default', async ({ page }) => {
  await page.goto('/portal/leads', { waitUntil: 'networkidle' });
  await expect(page.locator('main')).toContainText('فرصي');
});

import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

test.use({ storageState: ADMIN_STORAGE });

/**
 * Dates, amounts and counts follow the admin-locale cookie: in English they use
 * Latin digits and the currency code, not Arabic-Indic digits and ر.س. The
 * pages below show many of each.
 */
const ROUTES = [
  '/dashboard',
  '/dashboard/contracts',
  '/dashboard/deposits',
  '/dashboard/installments',
  '/dashboard/reservations',
  '/dashboard/reports/financial',
  '/dashboard/cheques',
  '/dashboard/audit-logs',
];

const ARABIC_DIGITS_OR_SYMBOL = /[٠-٩]|ر\.س|ج\.م/;

for (const route of ROUTES) {
  test(`${route} formats numbers and dates in English`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'admin-locale', value: 'en', url: baseURL! }]);
    await page.goto(route, { waitUntil: 'networkidle' });
    const text = await page.locator('main').innerText();
    expect(text.split('\n').filter((l) => ARABIC_DIGITS_OR_SYMBOL.test(l))).toEqual([]);
  });
}

test('Arabic stays the default, with Arabic-Indic digits', async ({ page }) => {
  await page.goto('/dashboard/deposits', { waitUntil: 'networkidle' });
  await expect(page.locator('main')).toContainText(/[٠-٩]/);
});

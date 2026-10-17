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

// U5 (owner-approved design): Arabic stays the default language, but every
// number uses Western digits — no Arabic-Indic digits mixed in.
for (const route of ROUTES) {
  test(`${route} stays Arabic with Western digits`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' });
    const main = page.locator('main');
    await expect(main).toContainText(/[\u0600-\u06FF]/);
    const text = await main.innerText();
    expect(text.split('\n').filter((l) => /[٠-٩]/.test(l))).toEqual([]);
  });
}

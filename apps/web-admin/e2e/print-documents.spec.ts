import { test, expect, type Browser, type Page } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

/**
 * Printed contracts and receipts carry the company letterhead (not the
 * "شركتنا" placeholder a non-admin used to get), amounts in the company
 * currency, and follow the dashboard language — Arabic RTL or English LTR.
 */
test.describe.configure({ mode: 'serial' });

async function firstDetailId(page: Page, list: string): Promise<string> {
  await page.goto(`/dashboard/${list}`, { waitUntil: 'networkidle' });
  const href = await page
    .locator(`main a[href^="/dashboard/${list}/"]`)
    .evaluateAll((as) =>
      as.map((a) => a.getAttribute('href') ?? '').find((h) => /\/[0-9a-f-]{36}$/.test(h)) ?? '',
    );
  expect(href, `a ${list} detail link`).toBeTruthy();
  return href.split('/').pop()!;
}

async function openPrint(browser: Browser, path: string, locale: 'ar' | 'en'): Promise<Page> {
  const ctx = await browser.newContext({ storageState: ADMIN_STORAGE });
  await ctx.addCookies([{ name: 'admin-locale', value: locale, url: 'http://localhost' }]);
  const page = await ctx.newPage();
  // The page opens the print dialog on load; headless Chromium ignores it.
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('print-document')).toBeVisible();
  return page;
}

let contractId = '';
let depositId = '';

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ADMIN_STORAGE });
  const page = await ctx.newPage();
  contractId = await firstDetailId(page, 'contracts');
  depositId = await firstDetailId(page, 'deposits');
  await ctx.close();
});

test('contract print: company letterhead, company currency, Arabic RTL', async ({ browser }) => {
  const page = await openPrint(browser, `/print/contracts/${contractId}`, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('عقد بيع وحدة عقارية');

  const company = (await page.getByTestId('print-company').innerText()).trim();
  expect(company).not.toBe('');
  expect(company).not.toBe('شركتنا');

  await expect(page.getByTestId('print-amount-total')).toContainText('ج.م');
  await expect(page.getByText('ختم الشركة')).toBeVisible();
  await page.context().close();
});

test('contract print follows the English dashboard: LTR, English labels, currency code', async ({ browser }) => {
  const page = await openPrint(browser, `/print/contracts/${contractId}`, 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Property Sale Contract');
  await expect(page.getByTestId('print-amount-total')).toContainText('EGP');
  await expect(page.getByText('Company stamp')).toBeVisible();
  await expect(page.getByTestId('print-document')).not.toContainText('عقد بيع');
  await page.context().close();
});

test('payment receipt print: receipt sentence with the amount, in both languages', async ({ browser }) => {
  const ar = await openPrint(browser, `/print/deposits/${depositId}`, 'ar');
  await expect(ar.getByRole('heading', { level: 1 })).toHaveText('إيصال استلام دفعة');
  await expect(ar.getByTestId('print-amount-total')).toContainText('ج.م');
  await expect(ar.getByText('استلمنا من')).toBeVisible();
  await ar.context().close();

  const en = await openPrint(browser, `/print/deposits/${depositId}`, 'en');
  await expect(en.getByRole('heading', { level: 1 })).toHaveText('Payment Receipt');
  await expect(en.getByText('Received from')).toBeVisible();
  await en.context().close();
});

import { test, expect, type Browser } from '@playwright/test';
import { ADMIN_STORAGE, SALES_STORAGE, BROKER_STORAGE } from './global-setup';

/**
 * The company currency is one value, set by the admin on the branding page,
 * and every role sees amounts in it: admin, sales and the broker portal.
 * (The old reports.currency setting was ADMIN-only — sales and brokers
 * silently got SAR whatever the admin chose.)
 */
test.describe.configure({ mode: 'serial' });

async function setCurrency(browser: Browser, code: string): Promise<void> {
  const ctx = await browser.newContext({ storageState: ADMIN_STORAGE });
  const page = await ctx.newPage();
  await page.goto('/dashboard/company/branding', { waitUntil: 'networkidle' });
  await page.getByTestId('company-currency').selectOption(code);
  await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
  await expect(page.getByText('تم حفظ الهوية البصرية')).toBeVisible();
  await ctx.close();
}

async function mainText(browser: Browser, storage: string, path: string): Promise<string> {
  const ctx = await browser.newContext({ storageState: storage });
  const page = await ctx.newPage();
  await page.goto(path, { waitUntil: 'networkidle' });
  const text = await page.locator('main').innerText();
  await ctx.close();
  return text;
}

// Pages with seeded amounts, one per role.
const PAGES: [string, string][] = [
  [ADMIN_STORAGE, '/dashboard/deposits'],
  [SALES_STORAGE, '/dashboard/units'],
  [BROKER_STORAGE, '/portal/units'],
];

test.afterAll(async ({ browser }) => {
  await setCurrency(browser, 'EGP');
});

test('switching to SAR changes amounts for admin, sales and broker; back to EGP changes them again', async ({ browser }) => {
  test.setTimeout(120_000);

  await setCurrency(browser, 'SAR');
  for (const [storage, path] of PAGES) {
    const text = await mainText(browser, storage, path);
    expect(text, `${path} in SAR`).toContain('ر.س');
    expect(text, `${path} in SAR`).not.toContain('ج.م');
  }

  await setCurrency(browser, 'EGP');
  for (const [storage, path] of PAGES) {
    const text = await mainText(browser, storage, path);
    expect(text, `${path} in EGP`).toContain('ج.م');
    expect(text, `${path} in EGP`).not.toContain('ر.س');
  }
});

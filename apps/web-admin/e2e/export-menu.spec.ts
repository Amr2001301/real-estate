import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE, SALES_STORAGE } from './global-setup';

/**
 * One export control across the dashboard: an "Export" button that downloads
 * directly (one format) or opens a menu explaining each format; the reports
 * page groups its four reports in one menu; list pages export what they show.
 */
test.describe.configure({ mode: 'serial' });

async function downloadFrom(page: Page, optionTestId: string): Promise<string> {
  await page.getByTestId('export-menu').first().click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(optionTestId).click(),
  ]);
  expect(await download.failure()).toBeNull();
  return download.suggestedFilename();
}

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STORAGE });

  test('reports page: one grouped menu; the branded sales PDF downloads', async ({ page }) => {
    await page.goto('/dashboard/reports', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('export-menu')).toHaveCount(1);
    await page.getByTestId('export-menu').click();
    const menu = page.getByRole('menu');
    for (const key of ['sales-report:pdf', 'financial-report:xlsx', 'broker-report:pdf', 'operational-report:csv']) {
      await expect(menu.getByTestId(`export-${key}`)).toBeVisible();
    }
    await page.keyboard.press('Escape');

    const name = await downloadFrom(page, 'export-sales-report:pdf');
    expect(name).toMatch(/^sales-report-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  test('dashboard report: the presentation PDF leads the menu', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.getByTestId('export-menu').first().click();
    const items = page.getByRole('menu').getByRole('menuitem');
    await expect(items.first()).toHaveAttribute('data-testid', 'export-dashboard-report:pdf');
    await expect(page.getByTestId('export-dashboard-report:xlsx')).toBeVisible();
    await expect(page.getByTestId('export-dashboard-report:csv')).toBeVisible();
  });

  test('units list exports what it shows (Excel)', async ({ page }) => {
    await page.goto('/dashboard/units?status=AVAILABLE', { waitUntil: 'networkidle' });
    const name = await downloadFrom(page, 'export-units:xlsx');
    expect(name).toMatch(/^units-.*\.xlsx$/);
  });

  test('customers list exports (CSV)', async ({ page }) => {
    await page.goto('/dashboard/customers', { waitUntil: 'networkidle' });
    const name = await downloadFrom(page, 'export-customers:csv');
    expect(name).toMatch(/^customers-.*\.csv$/);
  });
});

test.describe('sales', () => {
  test.use({ storageState: SALES_STORAGE });

  test('no export on inventory and no import on leads for a rep', async ({ page }) => {
    await page.goto('/dashboard/inventory', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('export-menu')).toHaveCount(0);
    await page.goto('/dashboard/leads', { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: /Excel/ })).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE, MANAGER_STORAGE, SALES_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Premium pass on three pages: the rep's earnings and targets, the targets
 * management page, and the company branding form with its live preview.
 */
test.describe('my compensation', () => {
  test.use({ storageState: SALES_STORAGE });

  test("this month's target and the earnings summary lead the page", async ({ page }) => {
    await gotoReady(page, '/dashboard/my-compensation');
    await expect(page.getByTestId('month-target')).toBeVisible();
    await expect(page.getByTestId('earnings')).toContainText('مستحق لك');
    // The month's activity sits under the target as four figures.
    await expect(page.getByTestId('month-target').getByTestId('figure')).toHaveCount(4);
  });

  test('earnings list shows at most six until "show all"', async ({ page }) => {
    await gotoReady(page, '/dashboard/my-compensation');
    const entries = page.getByTestId('entry');
    expect(await entries.count()).toBeLessThanOrEqual(6);
    const all = page.getByTestId('entries').getByRole('link', { name: /عرض الكل/ });
    if (await all.count()) {
      await all.click();
      await expect(page).toHaveURL(/entries=all/);
      expect(await page.getByTestId('entry').count()).toBeGreaterThan(6);
    }
  });
});

test.describe('targets management', () => {
  test.use({ storageState: MANAGER_STORAGE });

  test('four key figures and targets as rows with a status', async ({ page }) => {
    await gotoReady(page, '/dashboard/targets');
    await expect(page.getByTestId('targets-kpis').getByTestId('figure')).toHaveCount(4);
    await expect(page.locator('table')).toHaveCount(0);
  });
});

test.describe('branding', () => {
  test.use({ storageState: ADMIN_STORAGE });

  test('the live preview follows the display name and tagline as typed', async ({ page }) => {
    await gotoReady(page, '/dashboard/company/branding');
    const preview = page.getByTestId('brand-preview');
    await expect(preview).toBeVisible();
    await page.getByPlaceholder('اسم الشركة للعرض العام').fill('شركة المعاينة');
    await page.getByPlaceholder('وصف قصير بالعربية').fill('بيوت تدوم');
    await expect(preview).toContainText('شركة المعاينة');
    await expect(preview).toContainText('بيوت تدوم');
  });

  test('field labels use the theme text colour, not a fixed navy', async ({ page }) => {
    await gotoReady(page, '/dashboard/company/branding');
    await expect(page.locator('label.text-navy\\/80')).toHaveCount(0);
    await expect(page.getByText('الاسم المعروض', { exact: true })).toBeVisible();
  });
});

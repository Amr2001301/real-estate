import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * QA run 2, English sweep: an English admin screen must hydrate without errors
 * (the assistant and the reports pages did not) and carry no hard-coded Arabic
 * in the shell, the lead board or the activity feed.
 */
test.describe('English admin screens', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'admin-locale', value: 'en', url: baseURL ?? 'http://localhost:3001' }]);
  });

  for (const path of ['/dashboard/assistant', '/dashboard/reports', '/dashboard/leads']) {
    test(`${path} hydrates cleanly`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      page.on('console', (m) => {
        if (m.type() === 'error' && /hydrat/i.test(m.text())) errors.push(m.text().slice(0, 200));
      });
      await gotoReady(page, path);
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    });
  }

  test('the sidebar and the lead board speak English', async ({ page }) => {
    await gotoReady(page, '/dashboard/leads');
    await expect(page.locator('aside')).toContainText('Admin portal');
    await expect(page.locator('aside')).not.toContainText('بوابة المسؤولين');
    await expect(page.getByText('New leads', { exact: true }).first()).toBeVisible();
  });
});
